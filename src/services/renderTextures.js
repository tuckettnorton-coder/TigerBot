import { inflateSync } from 'node:zlib';

const DEFAULT_TEXTURE_VERSION = '1.21.11';
const TEXTURE_HOST = 'https://assets.mcasset.cloud';
const MAX_TEXTURES_PER_RENDER = 512;
const MAX_BLOCK_MODELS_PER_RENDER = 160;
const TEXTURE_FETCH_CONCURRENCY = 16;
const MODEL_FETCH_CONCURRENCY = 20;
const TEXTURE_FETCH_TIMEOUT_MS = 2200;
const MODEL_FETCH_TIMEOUT_MS = 2600;
const textureCache = new Map();
const jsonResourceCache = new Map();

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
  const version = resolveTextureVersion();
  const cacheKey = version + ':' + filename;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);

  const url = TEXTURE_HOST + '/' + version +
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

  textureCache.set(cacheKey, request);
  // Missing textures (or a temporary CDN outage) should be retried on a later
  // render instead of permanently sticking with the procedural fallback.
  request.then(texture => {
    if (!texture && textureCache.get(cacheKey) === request) {
      textureCache.delete(cacheKey);
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

function minecraftResourcePath(value) {
  if (typeof value !== 'string' || !value) return null;
  const colon = value.indexOf(':');
  if (colon >= 0) {
    if (value.slice(0, colon) !== 'minecraft') return null;
    value = value.slice(colon + 1);
  }
  if (!/^[a-z0-9_./-]+$/.test(value) || value.includes('..')) return null;
  return value;
}

async function fetchAssetJson(relativePath) {
  if (!/^(?:blockstates|models)\/[a-z0-9_./-]+\.json$/.test(relativePath) ||
      relativePath.includes('..')) return null;

  const version = resolveTextureVersion();
  const cacheKey = version + ':' + relativePath;
  if (jsonResourceCache.has(cacheKey)) return jsonResourceCache.get(cacheKey);

  const url = TEXTURE_HOST + '/' + version + '/assets/minecraft/' + relativePath;
  const request = (async () => {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(MODEL_FETCH_TIMEOUT_MS)
      });
      if (!response.ok) return null;
      const text = await response.text();
      return JSON.parse(text);
    } catch {
      return null;
    }
  })();

  jsonResourceCache.set(cacheKey, request);
  request.then(value => {
    if (!value && jsonResourceCache.get(cacheKey) === request) {
      jsonResourceCache.delete(cacheKey);
    }
  });
  return request;
}

function firstModelReference(blockState) {
  let value = null;
  if (blockState?.variants && typeof blockState.variants === 'object') {
    value = Object.values(blockState.variants)[0] ?? null;
  } else if (Array.isArray(blockState?.multipart) && blockState.multipart.length) {
    value = blockState.multipart[0]?.apply ?? null;
  }

  if (Array.isArray(value)) value = value[0] ?? null;
  return minecraftResourcePath(value?.model);
}

function resolveModelTextureValue(textures, value) {
  for (let depth = 0; depth < 12; depth++) {
    if (value && typeof value === 'object') {
      value = value.sprite;
      continue;
    }
    if (typeof value !== 'string') return null;
    if (value.startsWith('#')) {
      value = textures[value.slice(1)];
      continue;
    }
    break;
  }

  const resource = minecraftResourcePath(value);
  if (!resource || !resource.startsWith('block/')) return null;
  return resource.slice('block/'.length);
}

async function loadModelFaceTextureNames(modelReference) {
  let current = modelReference;
  const textures = Object.create(null);
  let elements = null;

  for (let depth = 0; depth < 20 && current; depth++) {
    const model = await fetchAssetJson('models/' + current + '.json');
    if (!model || typeof model !== 'object') break;

    // Visit the child before its parents: child texture keys must win.
    for (const [key, value] of Object.entries(model.textures || {})) {
      if (!(key in textures)) textures[key] = value;
    }
    if (elements === null && Array.isArray(model.elements)) {
      elements = model.elements;
    }

    current = minecraftResourcePath(model.parent);
  }

  const faces = Object.create(null);
  for (const element of elements || []) {
    for (const [face, details] of Object.entries(element.faces || {})) {
      if (faces[face]) continue;
      const texture = resolveModelTextureValue(textures, details?.texture);
      if (!texture) continue;

      const uv = Array.isArray(details?.uv) && details.uv.length === 4 &&
        details.uv.every(value => typeof value === 'number' && Number.isFinite(value))
        ? [...details.uv]
        : null;
      const rotationValue = Number(details?.rotation);
      const rotation = [0, 90, 180, 270].includes(rotationValue) ? rotationValue : 0;
      const tintindex = Number.isInteger(details?.tintindex) && details.tintindex >= 0
        ? details.tintindex
        : null;

      // Keep face metadata alongside the texture. The rasterizer needs these
      // values to map the pixels the same way vanilla's block model does.
      faces[face] = { texture, uv, rotation, tintindex };
    }
  }
  return faces;
}

async function loadMinecraftModelTextureMap(blockNames) {
  const entries = await mapWithConcurrency(
    blockNames.slice(0, MAX_BLOCK_MODELS_PER_RENDER),
    MODEL_FETCH_CONCURRENCY,
    async blockName => {
      const blockState = await fetchAssetJson('blockstates/' + blockName + '.json');
      const modelReference = firstModelReference(blockState);
      if (!modelReference) return [blockName, Object.create(null)];
      return [blockName, await loadModelFaceTextureNames(modelReference)];
    }
  );
  return new Map(entries);
}

/**
 * Convert normalized coordinates on a block face to Minecraft model UV units.
 * Vanilla face UV rectangles use a 0–16 coordinate space. Face rotation is a
 * quarter-turn of the texture within that rectangle, not a camera rotation.
 */
export function mapBlockFaceUv(u, v, descriptor = null) {
  let s = u;
  let t = v;
  const rotation = Number(descriptor?.rotation) || 0;

  if (rotation === 90) {
    [s, t] = [t, 1 - s];
  } else if (rotation === 180) {
    [s, t] = [1 - s, 1 - t];
  } else if (rotation === 270) {
    [s, t] = [1 - t, s];
  }

  const uv = descriptor?.uv;
  if (Array.isArray(uv) && uv.length === 4 && uv.every(Number.isFinite)) {
    return [
      uv[0] + s * (uv[2] - uv[0]),
      uv[1] + t * (uv[3] - uv[1])
    ];
  }
  return [s * 16, t * 16];
}

/**
 * Download/cache only the textures used by the most common block types.
 * Failure is non-fatal: missing textures retain the existing procedural
 * fallback, so a CDN outage never prevents /render from producing an image.
 */
export async function loadVanillaTextureMap(data) {
  const blockNames = (Array.isArray(data?.counts) ? data.counts : [])
    .filter(item => Array.isArray(item) && item[0])
    .slice(0, MAX_BLOCK_MODELS_PER_RENDER)
    .map(([name]) => cleanName(name));

  // Resolve Minecraft's official blockstate -> model -> parent texture chain.
  // This uses each block's declared per-face texture instead of guessing
  // filenames such as "blockname_top" for every material.
  const modelFaces = await loadMinecraftModelTextureMap(blockNames);

  const names = new Set();
  for (const [, faces] of modelFaces) {
    for (const face of Object.values(faces)) {
      const texture = typeof face === 'string' ? face : face?.texture;
      if (texture) names.add(texture);
    }
  }

  // Keep the previous resolver as a safe fallback for missing assets/models.
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

  const textureMap = new Map(loaded.filter(([, texture]) => texture));
  for (const [blockName, faces] of modelFaces) {
    for (const [face, descriptor] of Object.entries(faces)) {
      // The image pixels stay shared by texture name; only small face metadata
      // is stored per block face.
      textureMap.set('blockface:' + blockName + ':' + face, descriptor);
    }
  }
  return textureMap;
}
