import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { makePng } from '../src/commands/Tools/render.js';
import {
  decodePngTexture,
  getBlockTextureName,
  loadVanillaTextureMap
} from '../src/services/renderTextures.js';

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let bit = 0; bit < 8; bit++) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  CRC_TABLE[n] = value >>> 0;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const payload = Buffer.concat([name, data]);
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  name.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(payload), data.length + 8);
  return output;
}

function tinyRgbaPng(rgbaPixels, width, height) {
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    scanlines[rowStart] = 0; // PNG filter: None
    Buffer.from(rgbaPixels).copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

test('vanilla texture resolver selects top and side texture variants', () => {
  assert.equal(getBlockTextureName('minecraft:oak_log', 'top'), 'oak_log_top');
  assert.equal(getBlockTextureName('minecraft:oak_log', 'side'), 'oak_log');
  assert.equal(getBlockTextureName('minecraft:grass_block', 'top'), 'grass_block_top');
  assert.equal(getBlockTextureName('minecraft:grass_block', 'side'), 'grass_block_side');
  assert.equal(getBlockTextureName('minecraft:sandstone', 'bottom'), 'sandstone_bottom');
  assert.equal(getBlockTextureName('minecraft:oak_stairs', 'side'), 'oak_planks');
  assert.equal(getBlockTextureName('minecraft:waxed_copper_block', 'top'), 'copper_block');
});

test('decodes a PNG into RGBA pixels correctly', () => {
  const expected = Buffer.from([
    240, 30, 60, 255,
    20, 180, 90, 128
  ]);
  const decoded = decodePngTexture(tinyRgbaPng(expected, 2, 1));

  assert.equal(decoded.width, 2);
  assert.equal(decoded.height, 1);
  assert.deepEqual(decoded.pixels, expected);
});

test('texture loading uses vanilla PNG pixels and keeps the renderer online-safe', async () => {
  const expectedPixels = Buffer.from([240, 30, 60, 255]);
  const png = tinyRgbaPng(expectedPixels, 1, 1);
  const previousFetch = globalThis.fetch;
  let requested = '';

  globalThis.fetch = async url => {
    requested = String(url);
    return {
      ok: true,
      arrayBuffer: async () => png
    };
  };

  try {
    const textureMap = await loadVanillaTextureMap({
      counts: [['minecraft:stone', 10]]
    });
    assert.match(requested, /1\.21\.11\/assets\/minecraft\/textures\/block\/stone\.png$/);
    assert.ok(textureMap.has('stone'));
    assert.deepEqual(textureMap.get('stone').pixels, expectedPixels);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('render output changes when a vanilla texture is supplied', () => {
  const block = { x: 0, y: 0, z: 0, name: 'stone', color: '#85888a' };
  const data = {
    name: 'Texture Test',
    size: [1, 1, 1],
    total: 1,
    counts: [['minecraft:stone', 1]],
    blocks: [block]
  };
  const procedural = makePng(data, 1);
  const textured = makePng(data, 1, new Map([[
    'stone',
    { width: 1, height: 1, pixels: Buffer.from([240, 30, 60, 255]) }
  ]]));

  assert.notDeepEqual(textured, procedural);
});
