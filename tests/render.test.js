import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync, inflateSync } from 'node:zlib';
import renderCommand, { analyze, decodeStates, getPovSceneBlocks, makePng } from '../src/commands/Tools/render.js';

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

test('exports /render as a valid slash command with a required attachment', () => {
  const payload = renderCommand.data.toJSON();
  assert.equal(payload.name, 'render');
  assert.ok(payload.description.length > 0);
  assert.equal(typeof renderCommand.execute, 'function');
  assert.equal(payload.options.length, 1);
  assert.equal(payload.options[0].name, 'file');
  assert.equal(payload.options[0].type, 11);
  assert.equal(payload.options[0].required, true);
});

test('public render panel hides the material list behind a View Materials button', async () => {
  const schematic = multiRegionFixture();
  const originalFetch = globalThis.fetch;
  let deferArgs;
  let responsePayload;

  globalThis.fetch = async () => ({
    ok: true,
    arrayBuffer: async () => schematic.buffer.slice(
      schematic.byteOffset,
      schematic.byteOffset + schematic.byteLength
    )
  });

  const interaction = {
    options: {
      getAttachment: () => ({
        name: 'test.litematic',
        size: schematic.length,
        url: 'https://example.test/test.litematic'
      })
    },
    deferReply: async (...args) => { deferArgs = args; },
    editReply: async payload => { responsePayload = payload; return payload; }
  };

  try {
    await renderCommand.execute(interaction);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(deferArgs, []);
  assert.equal(responsePayload.components.length, 3);
  assert.equal(responsePayload.components[0].components.length, 5);
  assert.equal(responsePayload.components[1].components.length, 5);
  assert.deepEqual(responsePayload.components[0].components.map(button => button.data.label), ['1', '2', '3', '4', '5']);
  assert.deepEqual(responsePayload.components[1].components.map(button => button.data.label), ['6', '7', '8', '9', '10']);
  assert.equal(responsePayload.components[2].components[0].data.custom_id.startsWith('render_materials:'), true);
  assert.equal(responsePayload.components[2].components[0].data.label, 'Materials List');
  const description = responsePayload.embeds[0].data.description;
  assert.match(description, /Materials List/);
  assert.doesNotMatch(description, /stone|dirt|glass/i);
});

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
    [1, 0, 0],
    [0, 0, 0],
    [3, 1, 0]
  ]);
});


test('preserves Y and Z orientation for reversed Litematica regions', () => {
  const schematic = schematicBuffer([
    {
      name: 'reversed_yz',
      position: { x: 0, y: 7, z: 3 },
      size: { x: 1, y: -2, z: -2 },
      palette: ['minecraft:air', 'minecraft:stone', 'minecraft:dirt', 'minecraft:glass'],
      indices: [1, 2, 3, 1]
    }
  ], [1, 2, 2]);

  const result = analyze(schematic);
  assert.deepEqual(result.size, [1, 2, 2]);
  assert.equal(result.total, 4);
  assert.deepEqual(result.blocks.map(block => [block.x, block.y, block.z]), [
    [0, 1, 1],
    [0, 1, 0],
    [0, 0, 1],
    [0, 0, 0]
  ]);
});

test('creates a valid-sized PNG preview containing rendered pixels', () => {
  const result = analyze(multiRegionFixture());
  const png = makePng(result);
  assert.deepEqual(
    [...png.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10]
  );
  assert.equal(png.readUInt32BE(16), 2400);
  assert.equal(png.readUInt32BE(20), 1800);

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
  assert.equal(raw.length, 1800 * (1 + 2400 * 4));

  let hasNonBackgroundPixel = false;
  for (let row = 0; row < 1800 && !hasNonBackgroundPixel; row++) {
    const rowStart = row * (1 + 2400 * 4) + 1;
    for (let x = 0; x < 2400; x++) {
      const pixel = rowStart + x * 4;
      if (raw[pixel] !== 34 || raw[pixel + 1] !== 35 || raw[pixel + 2] !== 41) {
        hasNonBackgroundPixel = true;
        break;
      }
    }
  }
  assert.equal(hasNonBackgroundPixel, true);
});

test('renders ten distinct camera and cutaway POVs from the same schematic', () => {
  const blocks = [];
  for (let y = 0; y < 10; y++) {
    for (let z = 0; z < 8; z++) {
      for (let x = 0; x < 8; x++) {
        blocks.push({ x, y, z, name: 'stone', color: '#85888a' });
      }
    }
  }
  const result = {
    name: 'Ten POV fixture',
    size: [8, 10, 8],
    total: blocks.length,
    counts: [['minecraft:stone', blocks.length]],
    blocks
  };
  const signatures = Array.from({ length: 10 }, (_, index) => index + 1).map(pov => {
    const png = makePng(result, pov);
    assert.deepEqual(
      [...png.subarray(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10]
    );
    assert.equal(png.readUInt32BE(16), 2400);
    assert.equal(png.readUInt32BE(20), 1800);
    let hash = 2166136261;
    for (const byte of png) hash = Math.imul(hash ^ byte, 16777619);
    return hash >>> 0;
  });

  assert.equal(new Set(signatures).size, 10, 'each POV should have a unique angle or cutaway');
});

test('POVs 4–7 progressively remove top layers and POVs 8–10 cut the sides', () => {
  const blocks = [];
  for (let y = 0; y < 10; y++) {
    for (let z = 0; z < 10; z++) {
      for (let x = 0; x < 10; x++) {
        blocks.push({ x, y, z, name: 'stone', color: '#85888a' });
      }
    }
  }
  const data = { size: [10, 10, 10], blocks };

  const exterior = getPovSceneBlocks(data, 1);
  const interior = getPovSceneBlocks(data, 4);
  const deeperInterior = getPovSceneBlocks(data, 5);
  const thirdTopCut = getPovSceneBlocks(data, 6);
  const fourthTopCut = getPovSceneBlocks(data, 7);
  const sideCutX = getPovSceneBlocks(data, 8);
  const sideCutZ = getPovSceneBlocks(data, 9);
  const oppositeSideCut = getPovSceneBlocks(data, 10);

  assert.equal(exterior.length, 1000, 'exterior POV retains the complete schematic');
  assert.ok(interior.length > 0 && interior.length < exterior.length,
    'POV 4 removes the top layer');
  assert.ok(deeperInterior.length > 0 && deeperInterior.length < interior.length,
    'POV 5 removes one more top layer than POV 4');

  assert.ok(thirdTopCut.length < deeperInterior.length, 'POV 6 removes a third top layer');
  assert.ok(fourthTopCut.length < thirdTopCut.length, 'POV 7 removes a fourth top layer');
  assert.ok(sideCutX.length > 0 && sideCutX.length < exterior.length, 'POV 8 cuts one side');
  assert.ok(sideCutZ.length > 0 && sideCutZ.length < exterior.length, 'POV 9 cuts a perpendicular side');
  assert.ok(oppositeSideCut.length > 0 && oppositeSideCut.length < exterior.length, 'POV 10 cuts from the opposite side');
  assert.ok(sideCutX.every(block => block.z < 5),
    'POV 8 keeps the half-depth nearest its viewing direction');
  assert.ok(sideCutZ.every(block => block.x < 5),
    'POV 9 keeps the half-depth on the perpendicular axis');
  assert.ok(oppositeSideCut.every(block => block.z >= 5),
    'POV 10 keeps the opposite half-depth');

  assert.ok(interior.some(block => block.x === 5 && block.y === 5 && block.z === 5),
    'POV 4 keeps central blocks visible');
  assert.ok(deeperInterior.some(block => block.x === 5 && block.y === 5 && block.z === 5),
    'POV 5 keeps the central interior visible');
});

test('returns a clear error for invalid compressed input', () => {
  assert.throws(() => analyze(Buffer.from('not a schematic')), /valid gzip-compressed/i);
});
