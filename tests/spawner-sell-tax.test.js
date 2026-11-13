import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSpawnerPrice, buildSpawnerCalculationMessage, buildSpawnerMultiCalculationMessage } from '../src/utils/spawnerPricing.js';

test('Sell tickets deduct 2% and display both original and after-tax totals', async () => {
  const result = await calculateSpawnerPrice({ trade: 'sell', spawnerType: 'skeleton', amount: 10 });
  assert.equal(result.total, 75_000_000);
  assert.equal(result.taxDeduction, 1_500_000);
  assert.equal(result.totalAfterTax, 73_500_000);
  const message = buildSpawnerCalculationMessage(result);
  assert.match(message, /Cost without taxes:\*\* 75M/);
  assert.match(message, /2% tax deducted:\*\* -1\.5M/);
  assert.match(message, /Cost with taxes: 73\.5M/);
});

test('Sell tax applies to updated prices, not just default spawner prices', async () => {
  const client = { db: { get: async () => ({ spawnerPrices: { skeleton: { sell3: '10M' } } }) } };
  const result = await calculateSpawnerPrice({ trade: 'sell', spawnerType: 'skeleton', amount: 10, client, guildId: 'test' });
  assert.equal(result.total, 100_000_000);
  assert.equal(result.taxDeduction, 2_000_000);
  assert.equal(result.totalAfterTax, 98_000_000);
});

test('Buy tickets preserve their existing price without any tax deduction', async () => {
  const result = await calculateSpawnerPrice({ trade: 'buy', spawnerType: 'skeleton', amount: 10 });
  assert.equal(result.total, 90_000_000);
  assert.equal(result.taxDeduction, 0);
  assert.equal(result.totalAfterTax, result.total);
  const message = buildSpawnerCalculationMessage(result);
  assert.match(message, /Total: 90M/);
  assert.doesNotMatch(message, /Cost with taxes|2% tax deducted/);
});

test('The 64+ sell tier still applies before deducting tax', async () => {
  const result = await calculateSpawnerPrice({ trade: 'sell', spawnerType: 'skeleton', amount: 64 });
  assert.equal(result.tier, '64');
  assert.equal(result.total, 64 * 7_600_000);
  assert.equal(result.taxDeduction, Math.round(result.total * 0.02));
  assert.equal(result.totalAfterTax, result.total - result.taxDeduction);
});

test('Multi-spawner sell calculations show the combined 2% deduction', async () => {
  const results = await Promise.all([
    calculateSpawnerPrice({ trade: 'sell', spawnerType: 'skeleton', amount: 10 }),
    calculateSpawnerPrice({ trade: 'sell', spawnerType: 'creeper', amount: 10 }),
  ]);
  const message = buildSpawnerMultiCalculationMessage(results);
  assert.match(message, /Cost without taxes:\*\* 155M/);
  assert.match(message, /2% tax deducted:\*\* -3\.1M/);
  assert.match(message, /Cost with taxes: 151\.9M/);
});

test('Multi-spawner buy calculations remain unchanged', async () => {
  const results = await Promise.all([
    calculateSpawnerPrice({ trade: 'buy', spawnerType: 'skeleton', amount: 10 }),
    calculateSpawnerPrice({ trade: 'buy', spawnerType: 'creeper', amount: 10 }),
  ]);
  const message = buildSpawnerMultiCalculationMessage(results);
  assert.match(message, /Grand Total: 220M/);
  assert.doesNotMatch(message, /Cost with taxes|2% tax deducted/);
});
