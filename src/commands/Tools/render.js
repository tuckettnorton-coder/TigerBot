import { AttachmentBuilder, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { deflateSync, gunzipSync } from 'node:zlib';

const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_REGION_VOLUME = 5_000_000;
const MAX_RENDER_BLOCKS = 100_000;
const MAX_DRAWN_BLOCKS = 18_000;

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
      sx, sy, sz, volume, originX, originY, originZ, names, states
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
    const { sx, sy, sz, volume, originX, originY, originZ, names, states } = region;
    for (let i = 0; i < volume; i++) {
      const name = names[states[i]];
      if (/^(?:minecraft:)?(?:air|cave_air|void_air)$/.test(name)) continue;

      total++;
      counts.set(name, (counts.get(name) || 0) + 1);
      seenPreviewBlocks++;

      const block = {
        x: originX - minX + (i % sx),
        y: originY - minY + Math.floor(i / (sx * sz)),
        z: originZ - minZ + (Math.floor(i / sx) % sz),
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

export function makePng(data) {
  const W = 1200, H = 1000;
  const pixels = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    pixels[i * 4] = 34;
    pixels[i * 4 + 1] = 35;
    pixels[i * 4 + 2] = 41;
    pixels[i * 4 + 3] = 255;
  }

  const [sx, sy, sz] = data.size;
  const maxUnit = Math.min(
    12,
    (W - 100) * 2 / (sx + sz),
    (H - 140) / (sy + (sx + sz) / 2)
  );
  const unit = Math.max(0.05, maxUnit);
  const half = unit / 2;
  const projectedWidth = (sx + sz) * half;
  const projectedHeight = sy * unit + (sx + sz) * half;
  const xOffset = (W - projectedWidth) / 2 + sz * half;
  const yOffset = (H - projectedHeight) / 2 + sy * unit;
  const pt = (x, y, z) => [xOffset + (x - z) * half, yOffset + (x + z) * half - y * unit];

  const faces = [];
  const stride = Math.max(1, Math.ceil(data.blocks.length / MAX_DRAWN_BLOCKS));
  for (let i = 0; i < data.blocks.length; i += stride) {
    const b = data.blocks[i], x = b.x, y = b.y, z = b.z, c = b.color;
    const a = pt(x, y + 1, z), d = pt(x + 1, y + 1, z), e = pt(x + 1, y + 1, z + 1), f = pt(x, y + 1, z + 1);
    const g = pt(x + 1, y, z), h = pt(x + 1, y, z + 1), j = pt(x, y, z + 1);
    faces.push({
      k: x + z + y * 0.001,
      polys: [
        { pts: [d, e, h, g], color: shade(c, 0.70) },
        { pts: [f, e, h, j], color: shade(c, 0.84) },
        { pts: [a, d, e, f], color: c }
      ]
    });
  }
  faces.sort((a, b) => a.k - b.k);

  function fillPolygon(points, hex) {
    const rgb = [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ];
    const minY = Math.max(0, Math.floor(Math.min(...points.map(point => point[1]))));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(...points.map(point => point[1]))));
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.max(0, Math.ceil(xs[k]));
        const x1 = Math.min(W - 1, Math.floor(xs[k + 1]));
        for (let x = x0; x <= x1; x++) {
          const at = (y * W + x) * 4;
          pixels[at] = rgb[0];
          pixels[at + 1] = rgb[1];
          pixels[at + 2] = rgb[2];
          pixels[at + 3] = 255;
        }
      }
    }
  }

  for (const face of faces) {
    for (const polygon of face.polys) fillPolygon(polygon.pts, polygon.color);
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
      const materials = data.counts.slice(0, 20)
        .map(([name, count]) =>
          '• ' + name.replace(/^minecraft:/, '').slice(0, 80) + ': **' +
          count.toLocaleString('en-US') + '**'
        )
        .join('\n');
      const extra = data.counts.length > 20
        ? '\n…and ' + (data.counts.length - 20) + ' other block types.'
        : '';
      const embed = new EmbedBuilder()
        .setTitle('🧱 ' + data.name.slice(0, 240))
        .setDescription(
          '**Dimensions:** ' + data.size.join(' × ') + ' blocks\n' +
          '**Non-air blocks:** ' + data.total.toLocaleString('en-US') + '\n' +
          '**Block types:** ' + data.counts.length + '\n\n' +
          '**Materials list**\n' + (materials || 'No blocks found.') + extra
        )
        .setImage('attachment://schematic-render.png')
        .setFooter({ text: 'Preview uses simplified block colors; material counts are read from the file.' });

      return interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown rendering error.';
      return interaction.editReply('❌ Could not render this schematic: ' + message.slice(0, 1500));
    }
  }
};
