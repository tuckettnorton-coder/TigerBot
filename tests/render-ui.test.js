import test from 'node:test';
import assert from 'node:assert/strict';
import renderMaterialsButton from '../src/interactions/buttons/renderMaterials.js';
import { buildRenderViewComponents, getRenderView, saveRenderView } from '../src/services/renderViewUi.js';
import {
  buildMaterialComponents,
  buildMaterialsEmbed,
  getRenderMaterials,
  saveRenderMaterials
} from '../src/services/renderMaterialUi.js';

function sampleCounts(amount) {
  return Array.from({ length: amount }, (_, index) => [
    'minecraft:block_' + String(index).padStart(2, '0'),
    (index + 1) * 17
  ]);
}

test('private material browser uses a dropdown and paginates beyond 25 material types', () => {
  const id = 'render-ui-pagination-test';
  saveRenderMaterials(id, {
    name: 'Pagination Test',
    size: [30, 12, 8],
    total: 900,
    counts: sampleCounts(30)
  });

  const entry = getRenderMaterials(id);
  const firstPage = buildMaterialComponents(id, entry, 0).map(row => row.toJSON());
  const secondPage = buildMaterialComponents(id, entry, 1).map(row => row.toJSON());

  assert.equal(firstPage[0].components[0].type, 3);
  assert.equal(firstPage[0].components[0].options.length, 25);
  assert.equal(firstPage[1].components[0].disabled, true);
  assert.equal(firstPage[1].components[1].disabled, false);
  assert.equal(secondPage[0].components[0].options.length, 5);
  assert.equal(secondPage[1].components[0].disabled, false);
  assert.equal(secondPage[1].components[1].disabled, true);
});

test('View Materials opens a private ephemeral material browser', async () => {
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
  assert.equal(replyPayload.components[0].toJSON().components[0].type, 3);
});


test('render panel exposes five POV buttons and a separate View Materials button', () => {
  const id = 'render-view-controls-test';
  const rows = buildRenderViewComponents(id, 3).map(row => row.toJSON());

  assert.equal(rows.length, 2);
  assert.equal(rows[0].components.length, 5);
  assert.deepEqual(rows[0].components.map(button => button.label), ['1', '2', '3', '4', '5']);
  assert.equal(rows[0].components[2].style, 1, 'active POV is highlighted');
  assert.equal(rows[0].components[0].style, 2);
  assert.equal(rows[1].components.length, 1);
  assert.equal(rows[1].components[0].label, 'View Materials');
  assert.equal(rows[1].components[0].custom_id, 'render_materials:' + id);
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

test('material dropdown shows counts in the options instead of a separate inspection panel', () => {
  const id = 'render-dropdown-options-test';
  saveRenderMaterials(id, {
    name: 'Dropdown Test',
    size: [2, 2, 2],
    total: 30,
    counts: [['minecraft:stone', 18], ['minecraft:oak_planks', 12]]
  });

  const entry = getRenderMaterials(id);
  const select = buildMaterialComponents(id, entry, 0)[0].toJSON().components[0];
  const embed = buildMaterialsEmbed(entry, 0).toJSON();

  assert.match(select.placeholder, /material type/i);
  assert.deepEqual(select.options.map(option => option.label), ['stone', 'oak planks']);
  assert.deepEqual(select.options.map(option => option.description), ['Count: 18', 'Count: 12']);
  assert.doesNotMatch(embed.description, /Selected material|Exact count/i);
});
