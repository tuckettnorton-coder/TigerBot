import test from 'node:test';
import assert from 'node:assert/strict';
import renderMaterialsButton from '../src/interactions/buttons/renderMaterials.js';
import renderMaterialDismiss from '../src/interactions/buttons/renderMaterialDismiss.js';
import { buildRenderViewComponents, getRenderView, saveRenderView } from '../src/services/renderViewUi.js';
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
    counts: sampleCounts(120)
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
  assert.equal(replyPayload.components[0].toJSON().components[0].type, 3);
});


test('render panel exposes ten POV buttons and a separate Materials List button', () => {
  const id = 'render-view-controls-test';
  const rows = buildRenderViewComponents(id, 8).map(row => row.toJSON());

  assert.equal(rows.length, 3);
  assert.equal(rows[0].components.length, 5);
  assert.deepEqual(rows[0].components.map(button => button.label), ['1', '2', '3', '4', '5']);
  assert.deepEqual(rows[1].components.map(button => button.label), ['6', '7', '8', '9', '10']);
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

test('material panel lists names and counts directly without dropdowns or inspection controls', () => {
  const id = 'render-dropdown-options-test';
  saveRenderMaterials(id, {
    name: 'Dropdown Test',
    size: [2, 2, 2],
    total: 30,
    counts: [['minecraft:stone', 18], ['minecraft:oak_planks', 12]]
  });

  const controls = buildMaterialComponents(id, getRenderMaterials(id), 0)[0].toJSON().components;
  const embed = buildMaterialsEmbed(getRenderMaterials(id), 0).toJSON();

  assert.match(embed.description, /stone — \\*\\*18\\*\\*/i);
  assert.match(embed.description, /oak planks — \\*\\*12\\*\\*/i);
  assert.equal(controls.length, 1);
  assert.equal(controls[0].label, 'Dismiss');
  assert.doesNotMatch(embed.description, /dropdown|select a material/i);
});


  const entry = getRenderMaterials(id);
  const select = buildMaterialComponents(id, entry, 0)[0].toJSON().components[0];
  const embed = buildMaterialsEmbed(entry, 0).toJSON();

  assert.match(select.placeholder, /material type/i);
  assert.deepEqual(select.options.map(option => option.label), ['stone', 'oak planks']);
  assert.deepEqual(select.options.map(option => option.description), ['Count: 18', 'Count: 12']);
  assert.doesNotMatch(embed.description, /Selected material|Exact count/i);
});


test('Dismiss deletes the ephemeral material panel', async () => {
  let deleted = false;
  await renderMaterialDismiss.execute({ deleteReply: async () => { deleted = true; } });
  assert.equal(deleted, true);
});
