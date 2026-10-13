import { AttachmentBuilder, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { randomUUID } from 'node:crypto';
import { saveRenderMaterials } from '../../services/renderMaterialUi.js';
import { buildRenderViewComponents, saveRenderView } from '../../services/renderViewUi.js';
import { deflateSync, gunzipSync } from 'node:zlib';

const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_REGION_VOLUME = 5_000_000;
const MAX_RENDER_BLOCKS = 100_000;

export function parseNbt(input) {
  let data;
  try {
    data = gunzipSync(input, { maxOutputLength: MAX_UNCOMPRESSED_BYTES });
  } catch (error) {
    if (error?.code === 'ERR_BUFFER_TOO_LARGE') {
      throw new Error('The uncompressed schematic is larger than the 64 MB safety limit.');
    }
    throw new Error('The file is not a valid gzip-compressed Litematica schematic.');
  }

  let p = 0;
  const take = n => {
    if (!Number.isSafeInteger(n) || n < 0 || p + n > data.length) {
      throw new Error('Schematic NBT data is truncated or invalid.');
    }
    const b = data.subarray(p, p + n);
    p += n;
    return b;
  };
  const u8 = () => take(1).readUInt8(0);
  const i16 = () => take(2).readInt16BE(0);
  const u16 = () => take(2).readUInt16BE(0);
  const i32 = () => take(4).readInt32BE(0);
  const i64 = () => take(8).readBigInt64BE(0);
  const str = () => take(u16()).toString('utf8');

  function value(t) {
    switch (t) {
      case 1: return take(1).readInt8(0);
      case 2: return i16();
      case 3: return i32();
      case 4: return i64();
      case 5: return take(4).readFloatBE(0);
      case 6: return take(8).readDoubleBE(0);
      case 7: {
        const n = i32();
        if (n < 0 || n > data.length) throw new Error('Invalid NBT byte array.');
        return take(n);
      }
      case 8: return str();
      case 9: {
        const elementType = u8(), n = i32();
        if (n < 0 || n > 2_000_000) throw new Error('NBT list is too large.');
        return Array.from({ length: n }, () => value(elementType));
      }
      case 10: {
        const object = Object.create(null);
        while (true) {
          const elementType = u8();
          if (elementType === 0) break;
          object[str()] = value(elementType);
        }
        return object;
      }
      case 11: {
        const n = i32();
        if (n < 0 || n > 2_000_000) throw new Error('Invalid NBT int array.');
        return Array.from({ length: n }, () => i32());
      }
      case 12: {
        const n = i32();
        if (n < 0 || n > 2_000_000) throw new Error('Invalid NBT long array.');
        return Array.from({ length: n }, () => i64());
      }
      default:
        throw new Error('Unsupported NBT tag type ' + t);
    }
  }

  if (u8() !== 10) throw new Error('File is not a supported NBT schematic.');
  str();
  return value(10);
}

export function decodeStates(raw, paletteSize, volume) {
  if (!Number.isSafeInteger(paletteSize) || paletteSize < 1 ||
      !Number.isSafeInteger(volume) || volume < 0) {
    throw new Error('Invalid block palette or region volume.');
  }

  // Litematica stores indices as a continuous bit stream. An entry may cross
  // a 64-bit boundary, unlike the padded packing used by chunk palettes.
  const bits = Math.max(2, Math.ceil(Math.log2(Math.max(2, paletteSize))));
  const mask = (1n << BigInt(bits)) - 1n;
  const longs = raw || [];
  const expectedLength = Math.ceil(volume * bits / 64);
  if (longs.length !== expectedLength) {
    throw new Error('Invalid block-state data length for this region.');
  }

  const result = new Uint32Array(volume);
  for (let i = 0; i < volume; i++) {
    const bit = BigInt(i) * BigInt(bits);
    const longIndex = Number(bit / 64n);
    const shift = bit % 64n;
    let packed = BigInt.asUintN(64, longs[longIndex]) >> shift;
    if (shift + BigInt(bits) > 64n) {
      packed |= BigInt.asUintN(64, longs[longIndex + 1]) << (64n - shift);
    }

    const index = Number(packed & mask);
    if (index >= paletteSize) {
      throw new Error('A block-state index is outside the region palette.');
    }
    result[i] = index;
  }
  return result;
}

function blockColor(name) {
  const n = name.replace(/^minecraft:/, '');
  const groups = [
    [/glass|ice/, '#b5e7f7'], [/water/, '#397bc4'], [/grass|moss|leaves|vine/, '#648d45'],
    [/dirt|mud|podzol/, '#79553c'], [/stone|deepslate|cobble|andesite|diorite|granite|tuff|bedrock/, '#85888a'],
    [/sand|sandstone|end_stone/, '#d5c58a'], [/oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|bamboo|planks|log|wood|chest|barrel/, '#a47b4d'],
    [/iron|hopper|anvil|rail|chain|piston|dispenser|observer|dropper/, '#9da2a5'], [/redstone|repeater|comparator|lever|torch/, '#b9433f'],
    [/gold/, '#e0b83f'], [/diamond/, '#54d6cb'], [/emerald/, '#42a65b'], [/copper/, '#bd784e'],
    [/brick|terracotta|magma/, '#a35e4a'], [/obsidian|blackstone/, '#393344'], [/snow|quartz|white_concrete/, '#e4e3dd']
  ];
  for (const [re, color] of groups) if (re.test(n)) return color;
  return '#a8a8a8';
}

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [16, 8, 0].map(shift =>
    Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * factor)))
      .toString(16).padStart(2, '0')
  ).join('');
}

function integer(value, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error('Invalid ' + label + ' in schematic.');
  return result;
}

export function analyze(buffer) {
  const root = parseNbt(buffer);
  const regions = root.Regions;
  if (!regions || typeof regions !== 'object' || Array.isArray(regions)) {
    throw new Error('No Litematica regions found.');
  }

  const prepared = [];
  let volumeTotal = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const [regionName, region] of Object.entries(regions)) {
    const rawX = integer(region.Size?.x, 'region X size');
    const rawY = integer(region.Size?.y, 'region Y size');
    const rawZ = integer(region.Size?.z, 'region Z size');
    const sx = Math.abs(rawX), sy = Math.abs(rawY), sz = Math.abs(rawZ);
    const volume = sx * sy * sz;

    if (!sx || !sy || !sz || !Number.isSafeInteger(volume) || volume > MAX_REGION_VOLUME) {
      throw new Error('Region "' + regionName + '" has invalid or excessively large dimensions.');
    }
    volumeTotal += volume;
    if (volumeTotal > MAX_REGION_VOLUME) {
      throw new Error('The schematic exceeds the 5,000,000-block processing safety limit.');
    }

    const position = region.Position || Object.create(null);
    const px = integer(position.x ?? 0, 'region X position');
    const py = integer(position.y ?? 0, 'region Y position');
    const pz = integer(position.z ?? 0, 'region Z position');

    // Negative Litematica sizes mean the saved region was selected in reverse.
    // BlockStates still begin at the bounding box's minimum corner.
    const originX = px + (rawX < 0 ? rawX + 1 : 0);
    const originY = py + (rawY < 0 ? rawY + 1 : 0);
    const originZ = pz + (rawZ < 0 ? rawZ + 1 : 0);
    const endX = originX + sx, endY = originY + sy, endZ = originZ + sz;
    if (![originX, originY, originZ, endX, endY, endZ].every(Number.isSafeInteger)) {
      throw new Error('Region "' + regionName + '" has invalid coordinates.');
    }

    const palette = region.BlockStatePalette;
    if (!Array.isArray(palette) || !palette.length) {
      throw new Error('Region "' + regionName + '" has no block palette.');
    }
    const names = palette.map(entry =>
      typeof entry?.Name === 'string' && entry.Name.length ? entry.Name : 'minecraft:unknown'
    );
    const states = decodeStates(region.BlockStates, names.length, volume);

    prepared.push({
      sx, sy, sz, volume, originX, originY, originZ,
      flipX: rawX < 0, flipY: rawY < 0, flipZ: rawZ < 0,
      names, states
    });
    minX = Math.min(minX, originX);
    minY = Math.min(minY, originY);
    minZ = Math.min(minZ, originZ);
    maxX = Math.max(maxX, endX);
    maxY = Math.max(maxY, endY);
    maxZ = Math.max(maxZ, endZ);
  }

  if (!prepared.length) throw new Error('The schematic contains no regions.');

  const counts = new Map();
  const blocks = [];
  let total = 0;
  let seenPreviewBlocks = 0;

  for (const region of prepared) {
    const { sx, sy, sz, volume, originX, originY, originZ, flipX, flipY, flipZ, names, states } = region;
    for (let i = 0; i < volume; i++) {
      const name = names[states[i]];
      if (/^(?:minecraft:)?(?:air|cave_air|void_air)$/.test(name)) continue;

      total++;
      counts.set(name, (counts.get(name) || 0) + 1);
      seenPreviewBlocks++;

      const localX = i % sx;
      const localY = Math.floor(i / (sx * sz));
      const localZ = Math.floor(i / sx) % sz;
      const block = {
        x: originX - minX + (flipX ? sx - 1 - localX : localX),
        y: originY - minY + (flipY ? sy - 1 - localY : localY),
        z: originZ - minZ + (flipZ ? sz - 1 - localZ : localZ),
        name: name.replace(/^minecraft:/, ''),
        color: blockColor(name)
      };

      // Reservoir sampling keeps the preview representative even when a file
      // has more than MAX_RENDER_BLOCKS non-air blocks or several regions.
      if (blocks.length < MAX_RENDER_BLOCKS) {
        blocks.push(block);
      } else {
        const slot = Math.floor(Math.random() * seenPreviewBlocks);
        if (slot < MAX_RENDER_BLOCKS) blocks[slot] = block;
      }
    }
  }

  return {
    name: typeof root.Metadata?.Name === 'string' ? root.Metadata.Name : 'Minecraft Schematic',
    size: [maxX - minX, maxY - minY, maxZ - minZ],
    total,
    counts: [...counts].sort((a, b) => b[1] - a[1]),
    blocks
  };
}

export function makePng(data, pov = 1) {
  const W = 1600, H = 1200;
  const pixels = Buffer.alloc(W * H * 4);

  // A soft sky-to-slate backdrop makes the structure stand out without the
  // flat, unfinished background of the old preview.
  for (let y = 0; y < H; y++) {
    const t = y / Math.max(1, H - 1);
    const r = Math.round(24 + t * 12);
    const g = Math.round(29 + t * 11);
    const b = Math.round(42 + t * 13);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    }
  }

  const [sx, sy, sz] = data.size;
  const povIndex = Math.max(1, Math.min(5, Number.parseInt(pov, 10) || 1));
  const yaw = ((povIndex - 1) * Math.PI * 2) / 5;
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);

  // Rotate the build around its horizontal center for each of the five POVs.
  const rotate = (x, z) => {
    const dx = x - sx / 2;
    const dz = z - sz / 2;
    return [
      dx * cosine - dz * sine + sx / 2,
      dx * sine + dz * cosine + sz / 2
    ];
  };

  const corners = [
    rotate(0, 0),
    rotate(sx, 0),
    rotate(0, sz),
    rotate(sx, sz)
  ];
  const minViewX = Math.min(...corners.map(point => point[0]));
  const maxViewX = Math.max(...corners.map(point => point[0]));
  const minViewZ = Math.min(...corners.map(point => point[1]));
  const maxViewZ = Math.max(...corners.map(point => point[1]));
  const viewWidth = Math.max(1, maxViewX - minViewX);
  const viewDepth = Math.max(1, maxViewZ - minViewZ);
  const horizontalSpan = viewWidth + viewDepth;
  const halfMax = Math.max(1, horizontalSpan);
  const heightMax = Math.max(1, sy + horizontalSpan / 2);
  const unit = Math.max(0.00001, Math.min(
    18,
    (W - 180) * 2 / halfMax,
    (H - 180) / heightMax
  ));
  const half = unit / 2;
  const projectedWidth = horizontalSpan * half;
  const projectedHeight = sy * unit + horizontalSpan * half;
  const xOffset = (W - projectedWidth) / 2 + viewDepth * half;
  const yOffset = (H - projectedHeight) / 2 + sy * unit;
  const pt = (x, y, z) => {
    const [viewX, viewZ] = rotate(x, z);
    const localX = viewX - minViewX;
    const localZ = viewZ - minViewZ;
    return [
      xOffset + (localX - localZ) * half,
      yOffset + (localX + localZ) * half - y * unit
    ];
  };
  const sideVisible = (normalX, normalZ) => {
    const viewNormalX = normalX * cosine - normalZ * sine;
    const viewNormalZ = normalX * sine + normalZ * cosine;
    return viewNormalX + viewNormalZ > 0.000001;
  };

  function blendPixel(x, y, rgb, alpha) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const at = (y * W + x) * 4;
    pixels[at] = Math.round(pixels[at] * (1 - alpha) + rgb[0] * alpha);
    pixels[at + 1] = Math.round(pixels[at + 1] * (1 - alpha) + rgb[1] * alpha);
    pixels[at + 2] = Math.round(pixels[at + 2] * (1 - alpha) + rgb[2] * alpha);
  }

  // A subtle ground shadow anchors the build rather than leaving it floating.
  const shadowRx = Math.max(10, Math.min(W * 0.34, projectedWidth * 0.52));
  const shadowRy = Math.max(3, Math.min(25, shadowRx * 0.07));
  const shadowCy = Math.min(H - 2, (H + projectedHeight) / 2 + 14);
  const shadowTop = Math.max(0, Math.floor(shadowCy - shadowRy));
  const shadowBottom = Math.min(H - 1, Math.ceil(shadowCy + shadowRy));
  for (let y = shadowTop; y <= shadowBottom; y++) {
    const dy = (y - shadowCy) / shadowRy;
    for (let x = Math.max(0, Math.floor(W / 2 - shadowRx));
      x <= Math.min(W - 1, Math.ceil(W / 2 + shadowRx)); x++) {
      const dx = (x - W / 2) / shadowRx;
      const distance = dx * dx + dy * dy;
      if (distance < 1) {
        blendPixel(x, y, [8, 11, 18], (1 - distance) * 0.32);
      }
    }
  }

  const key = (x, y, z) => x + ',' + y + ',' + z;
  const occupied = new Set(data.blocks.map(block => key(block.x, block.y, block.z)));
  const faces = [];

  // Draw only block faces oriented toward this camera. As the POV changes,
  // the visible world-axis sides change too, not just the image coordinates.
  for (const block of data.blocks) {
    const x = block.x, y = block.y, z = block.z;
    const color = block.color || '#a8a8a8';
    const name = block.name || 'unknown';
    const base = { x, y, z, color, name };
    const topLeft = pt(x, y + 1, z);
    const topRight = pt(x + 1, y + 1, z);
    const topFront = pt(x + 1, y + 1, z + 1);
    const topBack = pt(x, y + 1, z + 1);
    const bottomLeft = pt(x, y, z);
    const bottomRight = pt(x + 1, y, z);
    const bottomFront = pt(x + 1, y, z + 1);
    const bottomBack = pt(x, y, z + 1);
    const [depthX, depthZ] = rotate(x + 0.5, z + 0.5);
    const depth = (depthX - minViewX) + (depthZ - minViewZ) + y * 0.001;

    if (sideVisible(1, 0) && !occupied.has(key(x + 1, y, z))) {
      faces.push({
        ...base, face: 'x', side: '+x', depth, order: 0,
        points: [topRight, topFront, bottomFront, bottomRight]
      });
    }
    if (sideVisible(-1, 0) && !occupied.has(key(x - 1, y, z))) {
      faces.push({
        ...base, face: 'x', side: '-x', depth, order: 0,
        points: [topLeft, topBack, bottomBack, bottomLeft]
      });
    }
    if (sideVisible(0, 1) && !occupied.has(key(x, y, z + 1))) {
      faces.push({
        ...base, face: 'z', side: '+z', depth, order: 1,
        points: [topBack, topFront, bottomFront, bottomBack]
      });
    }
    if (sideVisible(0, -1) && !occupied.has(key(x, y, z - 1))) {
      faces.push({
        ...base, face: 'z', side: '-z', depth, order: 1,
        points: [topLeft, topRight, bottomRight, bottomLeft]
      });
    }
    if (!occupied.has(key(x, y + 1, z))) {
      faces.push({
        ...base, face: 'top', side: 'top', depth, order: 2,
        points: [topLeft, topRight, topFront, topBack]
      });
    }
  }

  faces.sort((a, b) => a.depth - b.depth || a.order - b.order);

  const hexRgb = hex => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ];
  const toHex = rgb => '#' + rgb.map(channel =>
    Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')
  ).join('');
  const adjust = (hex, amount) => toHex(hexRgb(hex).map(channel => channel + amount));
  const light = (hex, factor) => toHex(hexRgb(hex).map(channel => channel * factor));

  function hashPixel(x, y, z, tx, ty) {
    let h = Math.imul((x + 4099) | 0, 73856093);
    h ^= Math.imul((y + 8191) | 0, 19349663);
    h ^= Math.imul((z + 16381) | 0, 83492791);
    h ^= Math.imul((tx + 31) | 0, 2654435761);
    h ^= Math.imul((ty + 17) | 0, 1597334677);
    h ^= h >>> 13;
    h = Math.imul(h, 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function oreColor(name) {
    if (/diamond/.test(name)) return '#55e5df';
    if (/emerald/.test(name)) return '#46df78';
    if (/gold/.test(name)) return '#f2d34a';
    if (/iron/.test(name)) return '#e1ad8d';
    if (/copper/.test(name)) return '#e58c5a';
    if (/lapis/.test(name)) return '#3769db';
    if (/redstone/.test(name)) return '#e84943';
    if (/coal/.test(name)) return '#28282b';
    if (/quartz/.test(name)) return '#f1e8d9';
    if (/netherite|ancient_debris/.test(name)) return '#a87963';
    return '#b4b9c0';
  }

  function textureColor(face, block, u, v) {
    const name = block.name;
    const txCount = Math.max(2, Math.min(16, Math.floor(unit / 1.55)));
    const tx = Math.max(0, Math.min(txCount - 1, Math.floor(u * txCount)));
    const ty = Math.max(0, Math.min(txCount - 1, Math.floor(v * txCount)));
    const noise = hashPixel(block.x, block.y, block.z, tx, ty);
    const variation = (noise % 19) - 9;
    let color = block.color;

    if (/grass_block|^grass$/.test(name)) {
      if (face === 'top') {
        const greens = ['#4f8435', '#568d38', '#60983d', '#4a7c30', '#6ba044'];
        color = greens[noise % greens.length];
      } else if (v < 0.20) {
        color = ['#578d35', '#61973c', '#4d7e2f'][noise % 3];
      } else {
        color = ['#785238', '#835b3c', '#704b32'][noise % 3];
      }
    } else if (/ore/.test(name)) {
      color = /deepslate/.test(name) ? '#4e5055' : '#777a7c';
      if ((noise % 13) < 3 || ((tx + ty + block.x + block.z) % 11 === 0)) {
        color = oreColor(name);
      } else if (noise % 5 === 0) {
        color = adjust(color, -14);
      }
    } else if (/stone|deepslate|cobble|andesite|diorite|granite|tuff|bedrock|blackstone/.test(name)) {
      if (noise % 11 === 0) color = adjust(block.color, -18);
      else if (noise % 7 === 0) color = adjust(block.color, 11);
      else color = adjust(block.color, variation * 0.7);
      if (/cobble/.test(name) && (tx % 5 === 0 || ty % 5 === 0)) color = adjust(color, -16);
    } else if (/dirt|mud|podzol|mycelium/.test(name)) {
      if (noise % 5 === 0) color = adjust(block.color, -13);
      else if (noise % 4 === 0) color = adjust(block.color, 10);
      else color = adjust(block.color, variation);
    } else if (/sand|sandstone|end_stone|gravel|clay/.test(name)) {
      color = adjust(block.color, noise % 6 === 0 ? -10 : variation * 0.6);
      if (/sandstone/.test(name) && ty % 5 === 0) color = adjust(color, -11);
    } else if (/planks/.test(name)) {
      color = adjust(block.color, variation);
      if (ty % 4 === 0) color = adjust(color, -14);
      if (tx % 8 === 0) color = adjust(color, -7);
    } else if (/log|wood|bamboo_block|stem|hyphae/.test(name)) {
      if (face === 'top' && /log|wood/.test(name)) {
        const dx = tx - (txCount - 1) / 2;
        const dy = ty - (txCount - 1) / 2;
        const ring = Math.floor(Math.sqrt(dx * dx + dy * dy));
        color = ring % 3 === 0 ? adjust(block.color, -13) : adjust(block.color, 7);
      } else {
        color = adjust(block.color, variation * 0.85);
        if (tx % 5 === 0) color = adjust(color, -15);
      }
    } else if (/leaves|vine|azalea|moss_block|moss_carpet/.test(name)) {
      const greens = ['#477b38', '#52873b', '#5d9140', '#3f7134', '#68994a'];
      color = greens[noise % greens.length];
      if (noise % 9 === 0) color = adjust(color, -17);
    } else if (/brick|terracotta|magma|nether_brick/.test(name)) {
      color = adjust(block.color, variation * 0.6);
      const mortar = ty % 4 === 0 || ((ty % 4 === 2) && tx % 6 === 0);
      if (mortar) color = adjust(color, -29);
    } else if (/glass|ice/.test(name)) {
      color = ['#a9d8e9', '#b8e5f1', '#99cfe2'][noise % 3];
      if (u < 0.12 || v < 0.12 || u > 0.88 || v > 0.88 || noise % 17 === 0) {
        color = '#e1f7ff';
      }
    } else if (/water/.test(name)) {
      color = noise % 5 === 0 ? '#2e6dad' : '#397bc4';
      if ((tx + ty + block.x) % 5 === 0) color = adjust(color, 14);
    } else if (/wool|concrete|concrete_powder|carpet|coral/.test(name)) {
      color = adjust(block.color, variation * 0.35);
    } else if (/redstone|repeater|comparator|lever|torch|lantern/.test(name)) {
      color = adjust(block.color, variation * 0.5);
    } else {
      color = adjust(block.color, variation * 0.55);
    }

    const faceLight = face === 'top' ? 1.04 : face === 'x' ? 0.72 : 0.86;
    return light(color, faceLight);
  }

  function fillPolygon(face) {
    const points = face.points;
    const minY = Math.max(0, Math.floor(Math.min(...points.map(point => point[1]))));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(...points.map(point => point[1]))));
    const start = face.face === 'top'
      ? pt(face.x, face.y + 1, face.z)
      : face.side === '+x'
        ? pt(face.x + 1, face.y + 1, face.z)
        : face.side === '-x' || face.side === '-z'
          ? pt(face.x, face.y + 1, face.z)
          : pt(face.x, face.y + 1, face.z + 1);

    for (let y = minY; y <= maxY; y++) {
      const scanY = y + 0.5;
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if ((a[1] <= scanY && b[1] > scanY) || (b[1] <= scanY && a[1] > scanY)) {
          xs.push(a[0] + (scanY - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
      xs.sort((a, b) => a - b);

      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.max(0, Math.ceil(xs[k] - 0.5));
        const x1 = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5, py = y + 0.5;
          let u, v;

          if (face.face === 'top') {
            const dx = px - start[0];
            const dy = py - start[1];
            u = (dx + dy) / unit;
            v = (dy - dx) / unit;
          } else if (face.face === 'x') {
            const localZ = (start[0] - px) / half;
            u = localZ;
            v = (py - start[1] - localZ * half) / unit;
          } else {
            const localX = (px - start[0]) / half;
            u = localX;
            v = (py - start[1] - localX * half) / unit;
          }

          const color = textureColor(face.face, face, u, v);
          const rgb = hexRgb(color);
          const at = (y * W + x) * 4;
          pixels[at] = rgb[0];
          pixels[at + 1] = rgb[1];
          pixels[at + 2] = rgb[2];
          pixels[at + 3] = 255;
        }
      }
    }
  }

  function drawLine(start, end, hex) {
    let x0 = Math.round(start[0]), y0 = Math.round(start[1]);
    const x1 = Math.round(end[0]), y1 = Math.round(end[1]);
    const dx = Math.abs(x1 - x0), sxStep = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), syStep = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    const rgb = hexRgb(hex);

    while (true) {
      if (x0 >= 0 && x0 < W && y0 >= 0 && y0 < H) {
        const at = (y0 * W + x0) * 4;
        pixels[at] = rgb[0];
        pixels[at + 1] = rgb[1];
        pixels[at + 2] = rgb[2];
        pixels[at + 3] = 255;
      }
      if (x0 === x1 && y0 === y1) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x0 += sxStep; }
      if (twice <= dx) { error += dx; y0 += syStep; }
    }
  }

  // Stroke each face immediately after filling it. Foreground faces can then
  // cover edges behind them, matching normal isometric depth ordering.
  for (const face of faces) {
    fillPolygon(face);
    const edgeColor = light(face.color, face.face === 'top' ? 0.57 : 0.48);
    for (let i = 0; i < face.points.length; i++) {
      drawLine(face.points[i], face.points[(i + 1) % face.points.length], edgeColor);
    }
  }

  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    pixels.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }

  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }
  const crc32 = buffer => {
    let c = 0xffffffff;
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, body) => {
    const typeBuffer = Buffer.from(type);
    const payload = Buffer.concat([typeBuffer, body]);
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    typeBuffer.copy(out, 4);
    body.copy(out, 8);
    out.writeUInt32BE(crc32(payload), 8 + body.length);
    return out;
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
export default {
  data: new SlashCommandBuilder()
    .setName('render')
    .setDescription('Render a Minecraft Litematica schematic and list materials')
    .addAttachmentOption(option =>
      option.setName('file').setDescription('A .litematic file').setRequired(true)
    ),

  async execute(interaction) {
    const file = interaction.options.getAttachment('file', true);
    if (!/\.litematic$/i.test(file.name)) {
      return interaction.reply({
        content: '❌ /render currently supports .litematic files only.',
        ephemeral: true
      });
    }
    if (file.size > 8 * 1024 * 1024) {
      return interaction.reply({
        content: '❌ Maximum schematic upload size is 8 MB.',
        ephemeral: true
      });
    }

    await interaction.deferReply();
    try {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error('Failed to download the uploaded file.');

      const data = analyze(Buffer.from(await response.arrayBuffer()));
      const png = makePng(data);
      const attachment = new AttachmentBuilder(png, { name: 'schematic-render.png' });
      const materialId = randomUUID();
      saveRenderMaterials(materialId, data);
      saveRenderView(materialId, data);

      const embed = new EmbedBuilder()
        .setTitle('🧱 ' + data.name.slice(0, 240))
        .setDescription(
          '**Dimensions:** ' + data.size.join(' × ') + ' blocks\n' +
          '**Non-air blocks:** ' + data.total.toLocaleString('en-US') + '\n' +
          '**Block types:** ' + data.counts.length.toLocaleString('en-US') + '\n\n' +
          'Click **View Materials** below to privately browse the exact block counts.'
        )
        .setImage('attachment://schematic-render.png')
        .setFooter({ text: 'Minecraft-style pixel textures and visible-face shading; counts come directly from the schematic.' });

      embed.setFooter({
        text: 'POV 1/5 · Minecraft-style pixel textures and visible-face shading; counts come directly from the schematic.'
      });

      return interaction.editReply({
        embeds: [embed],
        files: [attachment],
        components: buildRenderViewComponents(materialId, 1)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown rendering error.';
      return interaction.editReply('❌ Could not render this schematic: ' + message.slice(0, 1500));
    }
  }
};
