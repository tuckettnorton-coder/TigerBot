import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { makePng } from '../src/commands/Tools/render.js';
import { runRenderWorker } from '../src/services/renderWorker.js';
import { cacheRenderPng, getCachedRenderPng, getOrCreateRenderPng } from '../src/services/renderPngCache.js';
import {
  decodePngTexture,
  getBlockTextureName,
  loadVanillaTextureMap
} from '../src/services/renderTextures.js';
import renderMaterialsButton from '../src/interactions/buttons/renderMaterials.js';
import renderMaterialDismiss from '../src/interactions/buttons/renderMaterialDismiss.js';
import renderPovButton from '../src/interactions/buttons/renderPov.js';
import { buildRenderViewComponents, getPovButtonLabel, getRenderView, saveRenderView } from '../src/services/renderViewUi.js';
import {
  buildMaterialComponents,
  buildMaterialsEmbed,
  getMaterialPages,
  getRenderMaterials,
  saveRenderMaterials
} from '../src/services/renderMaterialUi.js';

function sampleCounts(amount) {
  return Array.from({ length: amount }, (_, index) => [
    'minecraft:block_' + String(index).padStart(2, '0'),
    (index + 1) * 17
  ]);
}

test('private material list renders directly and paginates only when it exceeds the embed size', () => {
  const id = 'render-ui-pagination-test';
  saveRenderMaterials(id, {
    name: 'Pagination Test',
    size: [30, 12, 8],
    total: 900,
    counts: sampleCounts(200)
  });

  const entry = getRenderMaterials(id);
  const firstPage = buildMaterialComponents(id, entry, 0).map(row => row.toJSON());
  const secondPage = buildMaterialComponents(id, entry, 1).map(row => row.toJSON());

  assert.ok(getMaterialPages(entry).length > 1);
  assert.equal(firstPage.length, 1);
  assert.equal(firstPage[0].components.length, 3);
  assert.equal(firstPage[0].components[0].label, 'Previous');
  assert.equal(firstPage[0].components[0].disabled, true);
  assert.equal(firstPage[0].components[1].label, 'Next');
  assert.equal(firstPage[0].components[1].disabled, false);
  assert.equal(firstPage[0].components[2].label, 'Dismiss');
  assert.equal(secondPage[0].components[0].disabled, false);
  assert.equal(secondPage[0].components[1].disabled, true);
  assert.equal(secondPage[0].components[2].custom_id, 'render_material_dismiss:' + id);
});

test('Materials List opens a private ephemeral panel with a dismiss button', async () => {
  const id = 'render-ui-private-test';
  saveRenderMaterials(id, {
    name: 'Private Test',
    size: [4, 3, 2],
    total: 7,
    counts: [['minecraft:stone', 7]]
  });

  let replyPayload;
  await renderMaterialsButton.execute({
    reply: async payload => { replyPayload = payload; }
  }, {}, [id]);

  assert.equal(replyPayload.ephemeral, true);
  assert.equal(replyPayload.embeds.length, 1);
  assert.equal(replyPayload.components.length, 1);
  assert.equal(replyPayload.components[0].toJSON().components[0].type, 2);
  assert.equal(replyPayload.components[0].toJSON().components[0].label, 'Dismiss');
});


test('render panel exposes ten POV buttons and a separate Materials List button', () => {
  const id = 'render-view-controls-test';
  const rows = buildRenderViewComponents(id, 8).map(row => row.toJSON());

  assert.equal(rows.length, 3);
  assert.equal(rows[0].components.length, 5);
  assert.deepEqual(rows[0].components.map(button => button.label), ['Front', 'Opposite', 'Under', 'Top −1', 'Top −2']);
  assert.deepEqual(rows[1].components.map(button => button.label), ['Top −3', 'Top −4', 'Half · Front', 'Half · Back', 'Half · Side']);
  assert.equal(rows[1].components[2].style, 1, 'active POV is highlighted');
  assert.equal(rows[0].components[0].style, 2);
  assert.equal(rows[1].components[4].custom_id, 'render_pov:' + id + ':10');
  assert.equal(rows[2].components.length, 1);
  assert.equal(rows[2].components[0].label, 'Materials List');
  assert.equal(rows[2].components[0].custom_id, 'render_materials:' + id);
});

test('camera POV cache preserves the render data needed to make a new angle', () => {
  const id = 'render-view-cache-test';
  const data = {
    name: 'Cache Test',
    size: [1, 1, 1],
    total: 1,
    counts: [['minecraft:stone', 1]],
    blocks: [{ x: 0, y: 0, z: 0, name: 'stone', color: '#85888a' }]
  };
  saveRenderView(id, data);
  assert.equal(getRenderView(id), data);
});

test('POV button acknowledges first and edits its original reply using the cached image', async () => {
  const id = 'render-pov-first-click-test';
  const cachedPng = Buffer.from('cached PNG fixture');
  const data = {
    name: 'First Click Test',
    size: [1, 1, 1],
    total: 1,
    counts: [['minecraft:stone', 1]],
    blocks: [{ x: 0, y: 0, z: 0, name: 'stone', color: '#85888a' }],
    renderTextures: new Map(),
    renderPngCache: new Map([[2, cachedPng]])
  };
  saveRenderView(id, data);

  const sequence = [];
  let editedPayload;
  const interaction = {
    message: { embeds: [] },
    deferUpdate: async () => { sequence.push('deferUpdate'); },
    editReply: async payload => {
      sequence.push('editReply');
      editedPayload = payload;
      return payload;
    }
  };

  await renderPovButton.execute(interaction, {}, [id, '2']);

  assert.deepEqual(sequence, ['deferUpdate', 'editReply']);
  assert.equal(data.renderPngCache.get(2), cachedPng, 'cached view should be reused');
  assert.equal(editedPayload.embeds[0].data.footer.text, 'POV 2/10 · Back · exact opposite exterior view');
  assert.equal(editedPayload.components.length, 3);
});

test('material panel lists names and counts directly without dropdowns or inspection controls', () => {
  const id = 'render-dropdown-options-test';
  saveRenderMaterials(id, {
    name: 'Material Test',
    size: [2, 2, 2],
    total: 30,
    counts: [['minecraft:stone', 18], ['minecraft:oak_planks', 12]]
  });

  const controls = buildMaterialComponents(id, getRenderMaterials(id), 0)[0].toJSON().components;
  const embed = buildMaterialsEmbed(getRenderMaterials(id), 0).toJSON();

  assert.ok(embed.description.includes('• stone — **18**'));
  assert.ok(embed.description.includes('• oak planks — **12**'));
  assert.equal(controls.length, 1);
  assert.equal(controls[0].label, 'Dismiss');
  assert.doesNotMatch(embed.description, /dropdown|select a material/i);
});


test('Dismiss deletes the ephemeral material panel', async () => {
  let deleted = false;
  await renderMaterialDismiss.execute({ deleteReply: async () => { deleted = true; } });
  assert.equal(deleted, true);
});


const TEXTURE_TEST_CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let bit = 0; bit < 8; bit++) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  TEXTURE_TEST_CRC_TABLE[n] = value >>> 0;
}

function textureTestCrc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = TEXTURE_TEST_CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function textureTestChunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const payload = Buffer.concat([name, data]);
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  name.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(textureTestCrc32(payload), data.length + 8);
  return output;
}

function textureTestPng(rgbaPixels, width, height) {
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    scanlines[rowStart] = 0;
    Buffer.from(rgbaPixels).copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    textureTestChunk('IHDR', ihdr),
    textureTestChunk('IDAT', deflateSync(scanlines)),
    textureTestChunk('IEND', Buffer.alloc(0))
  ]);
}

test('vanilla texture resolver selects correct top and side texture variants', () => {
  assert.equal(getBlockTextureName('minecraft:oak_log', 'top'), 'oak_log_top');
  assert.equal(getBlockTextureName('minecraft:oak_log', 'side'), 'oak_log');
  assert.equal(getBlockTextureName('minecraft:grass_block', 'top'), 'grass_block_top');
  assert.equal(getBlockTextureName('minecraft:grass_block', 'side'), 'grass_block_side');
  assert.equal(getBlockTextureName('minecraft:grass_block', 'bottom'), 'dirt');
  assert.equal(getBlockTextureName('minecraft:sandstone', 'bottom'), 'sandstone_bottom');
  assert.equal(getBlockTextureName('minecraft:oak_stairs', 'side'), 'oak_planks');
  assert.equal(getBlockTextureName('minecraft:waxed_copper_block', 'top'), 'copper_block');
});

test('vanilla texture PNG decoder preserves RGBA pixels', () => {
  const expected = Buffer.from([240, 30, 60, 255, 20, 180, 90, 128]);
  const decoded = decodePngTexture(textureTestPng(expected, 2, 1));
  assert.equal(decoded.width, 2);
  assert.equal(decoded.height, 1);
  assert.deepEqual(decoded.pixels, expected);
});

test('vanilla texture loader caches and returns the actual PNG pixels', async () => {
  const expected = Buffer.from([240, 30, 60, 255]);
  const png = textureTestPng(expected, 1, 1);
  const previousFetch = globalThis.fetch;
  let requested = '';

  globalThis.fetch = async url => {
    requested = String(url);
    return { ok: true, arrayBuffer: async () => png };
  };

  try {
    const textureMap = await loadVanillaTextureMap({
      counts: [['minecraft:stone', 10]]
    });
    assert.match(requested, /^https:\/\/assets\.mcasset\.cloud\/1\.21\.11\/assets\/minecraft\/textures\/block\/stone\.png$/);
    assert.ok(textureMap.has('stone'));
    assert.deepEqual(textureMap.get('stone').pixels, expected);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('schematic render samples supplied vanilla texture pixels', () => {
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


test('POV button labels identify each view position', () => {
  assert.equal(getPovButtonLabel(1), 'Front');
  assert.equal(getPovButtonLabel(2), 'Opposite');
  assert.equal(getPovButtonLabel(3), 'Under');
  assert.equal(getPovButtonLabel(4), 'Top −1');
  assert.equal(getPovButtonLabel(7), 'Top −4');
  assert.equal(getPovButtonLabel(8), 'Half · Front');
  assert.equal(getPovButtonLabel(9), 'Half · Back');
  assert.equal(getPovButtonLabel(10), 'Half · Side');
});


test('render worker returns a valid PNG while rasterization runs off the caller thread', async () => {
  const data = {
    size: [1, 1, 1],
    blocks: [{ x: 0, y: 0, z: 0, name: 'stone', color: '#85888a' }]
  };
  let eventLoopTicked = false;
  const tick = new Promise(resolve => setTimeout(() => {
    eventLoopTicked = true;
    resolve();
  }, 0));

  const pngPromise = runRenderWorker('render', {
    data,
    pov: 1,
    textureMap: new Map()
  });
  // Wait for a timer while the worker is rendering, before waiting for its PNG.
  await tick;

  assert.equal(eventLoopTicked, true, 'the main event loop should keep processing while PNG work runs');
  const png = await pngPromise;
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 2400);
  assert.equal(png.readUInt32BE(20), 1800);
});

test('render PNG cache shares simultaneous renders for the same schematic and POV', async () => {
  const id = 'render-cache-dedupe-' + Date.now();
  let calls = 0;
  const expected = Buffer.from('png-cache-test');
  const factory = async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 10));
    return expected;
  };

  const [first, second] = await Promise.all([
    getOrCreateRenderPng(id, 2, factory),
    getOrCreateRenderPng(id, 2, factory)
  ]);
  assert.equal(calls, 1);
  assert.equal(first, expected);
  assert.equal(second, expected);
  assert.equal(getCachedRenderPng(id, 2), expected);
  cacheRenderPng(id, 3, Buffer.from('another-test'));
  assert.ok(getCachedRenderPng(id, 3));
});


test('obsolete POV renders waiting in the worker queue can be skipped', async () => {
  const result = await runRenderWorker(
    'render',
    { data: {}, pov: 7, textureMap: new Map() },
    { shouldCancel: () => true }
  );
  assert.equal(result, null);
});
