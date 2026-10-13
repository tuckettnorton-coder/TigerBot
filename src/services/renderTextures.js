import { inflateSync } from 'node:zlib';

const DEFAULT_TEXTURE_VERSION = '1.21.11';
const TEXTURE_HOST = 'https://assets.mcasset.cloud';
const MAX_TEXTURES_PER_RENDER = 180;
const TEXTURE_FETCH_CONCURRENCY = 16;
const TEXTURE_FETCH_TIMEOUT_MS = 2200;
const textureCache = new Map();

const WOOD_FAMILIES = new Set([
  'oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak',
  'mangrove', 'cherry', 'pale_oak', 'bamboo', 'crimson', 'warped'
]);

const TEXTURE_ALIASES = new Map([
  ['stone_brick', 'stone_bricks'],
  ['mossy_stone_brick', 'mossy_stone_bricks'],
  ['cracked_stone_brick', 'cracked_stone_bricks'],
  ['nether_brick', 'nether_bricks'],
  ['red_nether_brick', 'red_nether_bricks'],
  ['mud_brick', 'mud_bricks'],
  ['brick', 'bricks'],
  ['prismarine_brick', 'prismarine_bricks'],
  ['quartz', 'quartz_block']
]);

function cleanName(blockName) {
  return String(blockName || 'unknown')
    .replace(/^minecraft:/, '')
    .replace(/\[.*$/, '')
    .toLowerCase();
}

function materialTextureName(name) {
  if (name.startsWith('waxed_')) name = name.slice('waxed_'.length);
  if (name === 'grass') return 'short_grass';
  if (name === 'water') return 'water_still';
  if (name === 'lava') return 'lava_still';

  const suffix = name.match(/^(.*)_(stairs|slab|wall|fence_gate|fence|pressure_plate|button)$/);
  if (suffix) {
    let base = suffix[1];
    if (WOOD_FAMILIES.has(base)) base += '_planks';
    return TEXTURE_ALIASES.get(base) || base;
  }

  return TEXTURE_ALIASES.get(name) || name;
}

/**
 * Resolve the closest vanilla block texture for the flat-cube preview.
 * The renderer samples actual 16x16 Minecraft texture pixels on each face.
 * Complex block models (stairs, fences, oriented machine faces) remain
 * cube approximations; this function chooses their underlying material.
 */
export function getBlockTextureName(blockName, face = 'top') {
  const name = cleanName(blockName);
  const faceKind = face === 'top' || face === 'bottom' ? face : 'side';

  const simpleFaceOverrides = {
    grass_block: { top: 'grass_block_top', side: 'grass_block_side', bottom: 'dirt' },
    podzol: { top: 'podzol_top', side: 'podzol_side', bottom: 'dirt' },
    mycelium: { top: 'mycelium_top', side: 'mycelium_side', bottom: 'dirt' },
    dirt_path: { top: 'dirt_path_top', side: 'dirt_path_side', bottom: 'dirt' },
    farmland: { top: 'farmland', side: 'dirt', bottom: 'dirt' },
    wet_farmland: { top: 'farmland_moist', side: 'dirt', bottom: 'dirt' },
    sandstone: { top: 'sandstone_top', side: 'sandstone', bottom: 'sandstone_bottom' },
    red_sandstone: { top: 'red_sandstone_top', side: 'red_sandstone', bottom: 'red_sandstone_bottom' },
    quartz_block: { top: 'quartz_block_top', side: 'quartz_block_side', bottom: 'quartz_block_bottom' },
    hay_block: { top: 'hay_block_top', side: 'hay_block_side', bottom: 'hay_block_top' },
    bone_block: { top: 'bone_block_top', side: 'bone_block_side', bottom: 'bone_block_top' },
    melon: { top: 'melon_top', side: 'melon_side', bottom: 'melon_top' },
    pumpkin: { top: 'pumpkin_top', side: 'pumpkin_side', bottom: 'pumpkin_top' },
    carved_pumpkin: { top: 'pumpkin_top', side: 'pumpkin_side', bottom: 'pumpkin_top' },
    bookshelf: { top: 'oak_planks', side: 'bookshelf', bottom: 'oak_planks' },
    crafting_table: { top: 'crafting_table_top', side: 'crafting_table_side', bottom: 'crafting_table_top' },
    furnace: { top: 'furnace_top', side: 'furnace_side', bottom: 'furnace_top' },
    blast_furnace: { top: 'blast_furnace_top', side: 'blast_furnace_side', bottom: 'blast_furnace_top' },
    smoker: { top: 'smoker_top', side: 'smoker_side', bottom: 'smoker_bottom' },
    barrel: { top: 'barrel_top', side: 'barrel_side', bottom: 'barrel_bottom' },
    composter: { top: 'composter_top', side: 'composter_side', bottom: 'composter_bottom' },
    end_portal_frame: { top: 'end_portal_frame_top', side: 'end_portal_frame_side', bottom: 'end_portal_frame_side' },
    basalt: { top: 'basalt_top', side: 'basalt_side', bottom: 'basalt_top' },
    polished_basalt: { top: 'polished_basalt_top', side: 'polished_basalt_side', bottom: 'polished_basalt_top' },
    crimson_nylium: { top: 'crimson_nylium', side: 'crimson_nylium_side', bottom: 'netherrack' },
    warped_nylium: { top: 'warped_nylium', side: 'warped_nylium_side', bottom: 'netherrack' }
  };

  if (simpleFaceOverrides[name]) return simpleFaceOverrides[name][faceKind];

  // Logs and wooden/Nether wood use an end-grain texture on top.
  if (name.endsWith('_wood')) {
    const logName = name.slice(0, -'_wood'.length) + '_log';
    return faceKind === 'top' || faceKind === 'bottom' ? logName + '_top' : logName;
  }
  if (name.endsWith('_log')) {
    return faceKind === 'top' || faceKind === 'bottom' ? name + '_top' : name;
  }
  if (name.endsWith('_stem')) {
    return faceKind === 'top' || faceKind === 'bottom' ? name + '_top' : name;
  }
  if (name.endsWith('_hyphae')) {
    const stemName = name.slice(0, -'_hyphae'.length) + '_stem';
    return stemName;
  }
  if (name === 'bamboo_block' || name === 'stripped_bamboo_block') {
    return faceKind === 'top' || faceKind === 'bottom' ? name + '_top' : name;
  }

  return materialTextureName(name);
}

/**
 * Decode ordinary 8-bit, non-interlaced PNGs to RGBA bytes. Vanilla Minecraft
 * block textures use small PNGs, so a tiny decoder avoids adding a native image
 * dependency to the bot. Unsupported/invalid texture formats simply fall back
 * to the built-in procedural coloring.
 */
export function decodePngTexture(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 ||
      !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error('Invalid PNG texture');
  }

  let width = 0, height = 0, bitDepth = 0, colorType = -1, interlace = 0;
  let palette = null, transparency = null;
  const imageDataChunks = [];

  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    if (length > buffer.length || offset + 12 + length > buffer.length) {
      throw new Error('Invalid PNG chunk size');
    }
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      interlace = chunk[12];
    } else if (type === 'PLTE') {
      palette = Buffer.from(chunk);
    } else if (type === 'tRNS') {
      transparency = Buffer.from(chunk);
    } else if (type === 'IDAT') {
      imageDataChunks.push(chunk);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  if (!width || !height || bitDepth !== 8 || interlace !== 0) {
    throw new Error('Unsupported PNG texture format');
  }

  const channelCount = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 })[colorType];
  if (!channelCount || (colorType === 3 && !palette)) {
    throw new Error('Unsupported PNG color type');
  }

  const inflated = inflateSync(Buffer.concat(imageDataChunks));
  const scanlineBytes = width * channelCount;
  if (inflated.length < height * (scanlineBytes + 1)) {
    throw new Error('Truncated PNG texture');
  }

  const decoded = Buffer.alloc(scanlineBytes * height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };

  for (let y = 0; y < height; y++) {
    const rawStart = y * (scanlineBytes + 1);
    const filter = inflated[rawStart];
    if (filter > 4) throw new Error('Unsupported PNG filter');
    for (let x = 0; x < scanlineBytes; x++) {
      const value = inflated[rawStart + 1 + x];
      const left = x >= channelCount ? decoded[y * scanlineBytes + x - channelCount] : 0;
      const up = y > 0 ? decoded[(y - 1) * scanlineBytes + x] : 0;
      const upperLeft = y > 0 && x >= channelCount
        ? decoded[(y - 1) * scanlineBytes + x - channelCount]
        : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upperLeft);
      decoded[y * scanlineBytes + x] = (value + predictor) & 0xff;
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const src = pixel * channelCount, dst = pixel * 4;
    if (colorType === 6) {
      rgba[dst] = decoded[src];
      rgba[dst + 1] = decoded[src + 1];
      rgba[dst + 2] = decoded[src + 2];
      rgba[dst + 3] = decoded[src + 3];
    } else if (colorType === 2) {
      rgba[dst] = decoded[src];
      rgba[dst + 1] = decoded[src + 1];
      rgba[dst + 2] = decoded[src + 2];
      rgba[dst + 3] = 255;
    } else if (colorType === 0) {
      rgba[dst] = rgba[dst + 1] = rgba[dst + 2] = decoded[src];
      rgba[dst + 3] = 255;
    } else if (colorType === 4) {
      rgba[dst] = rgba[dst + 1] = rgba[dst + 2] = decoded[src];
      rgba[dst + 3] = decoded[src + 1];
    } else if (colorType === 3) {
      const paletteIndex = decoded[src];
      const paletteOffset = paletteIndex * 3;
      if (paletteOffset + 2 >= palette.length) throw new Error('Invalid PNG palette index');
      rgba[dst] = palette[paletteOffset];
      rgba[dst + 1] = palette[paletteOffset + 1];
      rgba[dst + 2] = palette[paletteOffset + 2];
      rgba[dst + 3] = transparency && paletteIndex < transparency.length
        ? transparency[paletteIndex]
        : 255;
    }
  }

  return { width, height, pixels: rgba };
}

function resolveTextureVersion() {
  const configured = String(process.env.MINECRAFT_RENDER_TEXTURE_VERSION || DEFAULT_TEXTURE_VERSION);
  // Avoid URL/path injection; versions in the asset browser use digits and dots.
  return /^\d+(?:\.\d+){1,3}$/.test(configured) ? configured : DEFAULT_TEXTURE_VERSION;
}

async function fetchTexture(filename) {
  if (textureCache.has(filename)) return textureCache.get(filename);

  const url = TEXTURE_HOST + '/' + resolveTextureVersion() +
    '/assets/minecraft/textures/block/' + encodeURIComponent(filename) + '.png';

  const request = (async () => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(TEXTURE_FETCH_TIMEOUT_MS) });
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return decodePngTexture(Buffer.from(arrayBuffer));
    } catch {
      // Rendering must still work when the public texture mirror is unreachable.
      return null;
    }
  })();

  textureCache.set(filename, request);
  // Missing textures (or a temporary CDN outage) should be retried on a later
  // render instead of permanently sticking with the procedural fallback.
  request.then(texture => {
    if (!texture && textureCache.get(filename) === request) {
      textureCache.delete(filename);
    }
  });
  return request;
}

async function mapWithConcurrency(items, limit, fn) {
  const output = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      output[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return output;
}

/**
 * Download/cache only the textures used by the most common block types.
 * Failure is non-fatal: missing textures retain the existing procedural
 * fallback, so a CDN outage never prevents /render from producing an image.
 */
export async function loadVanillaTextureMap(data) {
  const blockNames = (Array.isArray(data?.counts) ? data.counts : [])
    .filter(item => Array.isArray(item) && item[0])
    .slice(0, 160)
    .map(([name]) => cleanName(name));

  const names = new Set();
  for (const blockName of blockNames) {
    names.add(getBlockTextureName(blockName, 'top'));
    names.add(getBlockTextureName(blockName, 'side'));
    names.add(getBlockTextureName(blockName, 'bottom'));
  }

  const filenames = [...names].filter(Boolean).slice(0, MAX_TEXTURES_PER_RENDER);
  const loaded = await mapWithConcurrency(filenames, TEXTURE_FETCH_CONCURRENCY, async filename => [
    filename,
    await fetchTexture(filename)
  ]);

  return new Map(loaded.filter(([, texture]) => texture));
}
