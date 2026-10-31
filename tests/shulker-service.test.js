import test from 'node:test';
import assert from 'node:assert/strict';
import { formatShulkerServiceMessage } from '../src/commands/Utility/shulker-update.js';
import { TICKET_TYPES } from '../src/config/ticketTypes.js';
import { buildShulkerUploadModal, getNextShulkerUpload, getShulkerUploadOrder, primaryShulkerRow } from '../src/interactions/selectMenus/shulker_service.js';
import { startShulkerDraft, patchShulkerDraft, clearShulkerDraft } from '../src/utils/shulkerDrafts.js';
import { buildShulkerAmountsModal, parseShulkerQuantity } from '../src/interactions/modals/shulker_service_quantity.js';

test('Shulker Service example updates automatically for every service fee', () => {
  for (const [fee, total] of [[10, '1.1b'], [20, '1.2b'], [30, '1.3b'], [40, '1.4b']]) {
    const message = formatShulkerServiceMessage({ serviceFeePercent: fee, refundFeePercent: 10 });
    assert.match(message, new RegExp(`add ${fee}% to that price`));
    assert.ok(message.includes(`the total would be ${total}`));
  }
});

test('Shulker Service refund percentage updates without changing other policy text', () => {
  const message = formatShulkerServiceMessage({ serviceFeePercent: 30, refundFeePercent: 15 });
  assert.ok(message.includes('a **15% fee** will be deducted'));
  assert.ok(message.includes('within 48hrs'));
  assert.ok(message.includes('NO refunds will be taken'));
  assert.ok(message.includes('WE NEVER GO FIRST'));
  assert.ok(message.includes('Min: 27 shulkers'));
});

test('Shulker Service uses its dedicated category and Support welcome roles', () => {
  const shulker = TICKET_TYPES.shulker_service;
  const support = TICKET_TYPES.support;
  assert.equal(shulker.categoryId, '1566191035934179439');
  assert.equal(shulker.categoryName, 'Shulker Service');
  assert.equal(shulker.welcomeMessage, support.welcomeMessage);
  assert.deepEqual(shulker.pingRoles, support.pingRoles);
});

test('Inventory-only and Hotbar-only tickets require exactly one matching upload field', () => {
  for (const first of ['inventory', 'hotbar']) {
    const draft = {
      sessionId: first,
      primary: first,
      includeInventory: first === 'inventory',
      includeHotbar: first === 'hotbar',
      screenshots: {},
    };
    assert.deepEqual(getShulkerUploadOrder(draft), [first]);
    assert.equal(getNextShulkerUpload(draft), first);
    const modal = buildShulkerUploadModal(draft).toJSON();
    assert.equal(modal.components.length, 1);
    assert.ok(JSON.stringify(modal).includes(`${first}_image`));
    const other = first === 'inventory' ? 'hotbar' : 'inventory';
    assert.ok(!JSON.stringify(modal).includes(`${other}_image`));
  }
});

test('Both views are uploaded one after the other, in the order selected', () => {
  for (const first of ['inventory', 'hotbar']) {
    const other = first === 'inventory' ? 'hotbar' : 'inventory';
    const draft = {
      sessionId: `both-${first}`,
      primary: first,
      includeInventory: true,
      includeHotbar: true,
      screenshots: {},
    };
    assert.deepEqual(getShulkerUploadOrder(draft), [first, other]);
    const firstModal = buildShulkerUploadModal(draft).toJSON();
    assert.equal(firstModal.components.length, 1);
    assert.ok(JSON.stringify(firstModal).includes(`${first}_image`));
    assert.ok(!JSON.stringify(firstModal).includes(`${other}_image`));

    draft.screenshots[first] = { name: 'first.png', url: 'https://example.com/first.png' };
    assert.equal(getNextShulkerUpload(draft), other);
    const nextModal = buildShulkerUploadModal(draft).toJSON();
    assert.equal(nextModal.components.length, 1);
    assert.ok(JSON.stringify(nextModal).includes(`${other}_image`));
    assert.ok(!JSON.stringify(nextModal).includes(`${first}_image`));

    draft.screenshots[other] = { name: 'second.png', url: 'https://example.com/second.png' };
    assert.equal(getNextShulkerUpload(draft), null);
  }
});

test('Shulker draft tracks separate selected quantities and screenshots', () => {
  const draft = startShulkerDraft('shulker-test-guild', 'shulker-test-user');
  patchShulkerDraft('shulker-test-guild', 'shulker-test-user', draft.sessionId, {
    primary: 'inventory',
    includeInventory: true,
    includeHotbar: false,
  });
  assert.equal(getNextShulkerUpload(draft), 'inventory');
  assert.equal(draft.inventoryAmount, null);
  assert.equal(draft.hotbarAmount, null);
  patchShulkerDraft('shulker-test-guild', 'shulker-test-user', draft.sessionId, {
    inventoryAmount: 27,
    amountsComplete: true,
  });
  assert.equal(draft.inventoryAmount, 27);
  assert.equal(draft.hotbarAmount, null);
  patchShulkerDraft('shulker-test-guild', 'shulker-test-user', draft.sessionId, {
    screenshots: { inventory: { url: 'https://example.com/inventory.png', name: 'inventory.png' } },
  });
  assert.equal(getNextShulkerUpload(draft), null);
  clearShulkerDraft('shulker-test-guild', 'shulker-test-user');
});

test('Shulker tickets still show the two exclusive first-choice options', () => {
  const primary = primaryShulkerRow('test').toJSON();
  assert.equal(primary.components[0].options.length, 2);
});

test('Each selected shulker type requires its own whole-number quantity of at least 27', () => {
  for (const invalid of ['0', '1', '26', '1.5', '-27', '27.5', 'twenty seven', '12,34', '']) {
    assert.equal(parseShulkerQuantity(invalid), null);
  }
  assert.equal(parseShulkerQuantity('27'), 27);
  assert.equal(parseShulkerQuantity('54'), 54);
  assert.equal(parseShulkerQuantity('1,000'), 1000);
});

test('Quantity modal has one field when only Inventory or only Hotbar is selected', () => {
  for (const first of ['inventory', 'hotbar']) {
    const draft = {
      sessionId: `quantity-${first}`,
      primary: first,
      includeInventory: first === 'inventory',
      includeHotbar: first === 'hotbar',
    };
    const data = buildShulkerAmountsModal(draft).toJSON();
    assert.equal(data.components.length, 1);
    assert.ok(JSON.stringify(data).includes(`${first}_amount`));
    const other = first === 'inventory' ? 'hotbar' : 'inventory';
    assert.ok(!JSON.stringify(data).includes(`${other}_amount`));
  }
});

test('Quantity modal has separate minimum-27 Inventory and Hotbar fields when both are selected', () => {
  for (const primary of ['inventory', 'hotbar']) {
    const draft = { sessionId: 'quantity-both', primary, includeInventory: true, includeHotbar: true };
    const data = buildShulkerAmountsModal(draft).toJSON();
    assert.equal(data.components.length, 2);
    assert.ok(JSON.stringify(data).includes('inventory_amount'));
    assert.ok(JSON.stringify(data).includes('hotbar_amount'));
    const fields = data.components.map(row => row.components[0].custom_id);
    assert.deepEqual(fields, primary === 'inventory'
      ? ['inventory_amount', 'hotbar_amount']
      : ['hotbar_amount', 'inventory_amount']);
  }
});

test('Shulker ticket fields show each selected amount separately', () => {
  const fields = TICKET_TYPES.shulker_service.form;
  assert.equal(fields.some(field => field.id === 'shulker_count'), false);
  assert.ok(fields.some(field => field.id === 'inventory_amount'));
  assert.ok(fields.some(field => field.id === 'hotbar_amount'));
});
