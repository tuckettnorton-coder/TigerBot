import test from 'node:test';
import assert from 'node:assert/strict';
import renderMaterialsButton from '../src/interactions/buttons/renderMaterials.js';
import {
  buildMaterialComponents,
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
