import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync, inflateSync } from 'node:zlib';
import { analyze, decodeStates, makePng } from '../src/commands/Tools/render.js';

const int32 = value => {
  const out = Buffer.alloc(4);
  out.writeInt32BE(value);
  return out;
};

const nbtString = value => {
  const content = Buffer.from(value, 'utf8');
  const length = Buffer.alloc(2);
  length.writeUInt16BE(content.length);
  return Buffer.concat([length, content]);
};

const namedTag = (type, name, payload) =>
  Buffer.concat([Buffer.from([type]), nbtString(name), payload]);

const compoundPayload = tags => Buffer.concat([...tags, Buffer.from([0])]);
const compoundTag = (name, tags) => namedTag(10, name, compoundPayload(tags));
const stringTag = (name, value) => namedTag(8, name, nbtString(value));
const intTag = (name, value) => namedTag(3, name, int32(value));

function listOfCompoundsTag(name, items) {
  return namedTag(9, name, Buffer.concat([
    Buffer.from([10]),
    int32(items.length),
    ...items.map(compoundPayload)
  ]));
}

function packIndices(indices, paletteSize) {
  const bits = Math.max(2, Math.ceil(Math.log2(Math.max(2, paletteSize))));
  const words = Array(Math.ceil(indices.length * bits / 64)).fill(0n);
  const wordMask = (1n << 64n) - 1n;

  indices.forEach((value, index) => {
    const bit = BigInt(index * bits);
    const longIndex = Number(bit / 64n);
    const shift = bit % 64n;
    const packed = BigInt(value) << shift;
    words[longIndex] |= packed & wordMask;
    if (shift + BigInt(bits) > 64n) {
      words[longIndex + 1] |= packed >> 64n;
    }
  });

  return Buffer.concat([
    int32(words.length),
    ...words.map(word => {
      const out = Buffer.alloc(8);
      out.writeBigInt64BE(BigInt.asIntN(64, word));
      return out;
    })
  ]);
}

function paletteTag(names) {
  return listOfCompoundsTag('BlockStatePalette', names.map(name => [
    stringTag('Name', name)
  ]));
}

function vectorTag(name, vector) {
  return compoundTag(name, [
    intTag('x', vector.x),
    intTag('y', vector.y),
    intTag('z', vector.z)
  ]);
}

function regionTag(region) {
  return compoundTag(region.name, [
    vectorTag('Position', region.position),
    vectorTag('Size', region.size),
    paletteTag(region.palette),
    namedTag(12, 'BlockStates', packIndices(region.indices, region.palette.length))
  ]);
}

function schematicBuffer(regions, dimensions, name = 'Renderer Test') {
  const nonAir = regions.reduce((sum, region) =>
    sum + region.indices.filter(index => {
      const block = region.palette[index];
      return !/^(?:minecraft:)?(?:air|cave_air|void_air)$/.test(block);
    }).length, 0);

  const metadata = compoundTag('Metadata', [
    stringTag('Name', name),
    intTag('TotalBlocks', nonAir),
    vectorTag('EnclosingSize', { x: dimensions[0], y: dimensions[1], z: dimensions[2] })
  ]);
  const regionsTag = compoundTag('Regions', regions.map(region => regionTag(region)));
  const rawNbt = Buffer.concat([
    Buffer.from([10]),
    nbtString(''),
    compoundPayload([metadata, regionsTag])
  ]);
  return gzipSync(rawNbt);
}

const multiRegionFixture = () => schematicBuffer([
  {
    name: 'west',
    position: { x: 11, y: 4, z: 0 },
    size: { x: -2, y: 1, z: 1 },
    palette: ['minecraft:air', 'minecraft:stone', 'minecraft:dirt'],
    indices: [1, 2]
  },
  {
    name: 'upper_east',
    position: { x: 13, y: 5, z: 0 },
    size: { x: 1, y: 1, z: 1 },
    palette: ['minecraft:air', 'minecraft:glass'],
    indices: [1]
  }
], [4, 2, 1]);

test('decodes continuous packed states across 64-bit boundaries', () => {
  const paletteSize = 17;
  const indices = Array.from({ length: 30 }, (_, index) => (index * 7) % paletteSize);
  const buffer = packIndices(indices, paletteSize);
  const count = buffer.readInt32BE(0);
  const longs = [];
  for (let i = 0; i < count; i++) {
    longs.push(buffer.readBigInt64BE(4 + i * 8));
  }
  assert.deepEqual(Array.from(decodeStates(longs, paletteSize, indices.length)), indices);
});

test('rejects mismatched packed-state array lengths', () => {
  assert.throws(() => decodeStates([], 2, 10), /data length/i);
});

test('analyzes multiple positioned regions and negative region sizes correctly', () => {
  const result = analyze(multiRegionFixture());
  assert.equal(result.name, 'Renderer Test');
  assert.deepEqual(result.size, [4, 2, 1]);
  assert.equal(result.total, 3);
  assert.deepEqual(Object.fromEntries(result.counts), {
    'minecraft:stone': 1,
    'minecraft:dirt': 1,
    'minecraft:glass': 1
  });
  assert.deepEqual(result.blocks.map(block => [block.x, block.y, block.z]), [
    [0, 0, 0],
    [1, 0, 0],
    [3, 1, 0]
  ]);
});

test('creates a valid-sized PNG preview containing rendered pixels', () => {
  const result = analyze(multiRegionFixture());
  const png = makePng(result);
  assert.deepEqual(
    [...png.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10]
  );
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 1000);

  let offset = 8;
  const idat = [];
  const chunkTypes = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    chunkTypes.push(type);
    if (type === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  assert.deepEqual(chunkTypes, ['IHDR', 'IDAT', 'IEND']);
  const raw = inflateSync(Buffer.concat(idat));
  assert.equal(raw.length, 1000 * (1 + 1200 * 4));

  let hasNonBackgroundPixel = false;
  for (let row = 0; row < 1000 && !hasNonBackgroundPixel; row++) {
    const rowStart = row * (1 + 1200 * 4) + 1;
    for (let x = 0; x < 1200; x++) {
      const pixel = rowStart + x * 4;
      if (raw[pixel] !== 34 || raw[pixel + 1] !== 35 || raw[pixel + 2] !== 41) {
        hasNonBackgroundPixel = true;
        break;
      }
    }
  }
  assert.equal(hasNonBackgroundPixel, true);
});

test('returns a clear error for invalid compressed input', () => {
  assert.throws(() => analyze(Buffer.from('not a schematic')), /valid gzip-compressed/i);
});
