import test from 'node:test';
import assert from 'node:assert/strict';
import { formatShulkerServiceMessage } from '../src/commands/Utility/shulker-update.js';
import { TICKET_TYPES } from '../src/config/ticketTypes.js';

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
