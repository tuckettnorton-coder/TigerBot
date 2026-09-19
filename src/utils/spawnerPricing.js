import { loadPrices } from '../commands/Utility/spawner-update.js';
import { parseAmount, formatResult } from './calculator.js';
import { getLatestUpdateData } from './updateState.js';

const LABELS = { skeleton: 'Skeleton', creeper: 'Creeper', irongolem: 'Iron Golem' };

function parsePrice(value) {
  const parsed = parseAmount(value);
  if (parsed === null || parsed < 0) throw new Error(`Invalid spawner price: ${value}`);
  return parsed;
}

export async function getCurrentSpawnerPrices(client, guildId) {
  const saved = await getLatestUpdateData(client, guildId, 'spawnerPrices', null);
  return saved && typeof saved === 'object' ? saved : loadPrices();
}

export async function calculateSpawnerPrice({ trade, spawnerType, amount, client = null, guildId = null }) {
  if (!['buy', 'sell'].includes(trade)) throw new Error('Invalid buy/sell selection.');
  if (!LABELS[spawnerType]) throw new Error('Invalid spawner type.');
  const quantity = Number(amount);
  if (!Number.isFinite(quantity) || quantity < 3 || !Number.isInteger(quantity)) {
    throw new Error('Spawner quantity must be a whole number of at least 3.');
  }
  const prices = await getCurrentSpawnerPrices(client, guildId);
  const priceSet = prices[spawnerType];
  const tier = quantity >= 64 ? '64' : '3';
  const unitPrice = parsePrice(priceSet?.[`${trade}${tier}`]);
  const total = unitPrice * quantity;
  return { trade, spawnerType, spawnerLabel: LABELS[spawnerType], quantity, tier, unitPrice, unitPriceFormatted: formatResult(unitPrice), total, totalFormatted: formatResult(total) };
}

export function buildSpawnerCalculationMessage(result) {
  const action = result.trade === 'buy' ? 'You are buying from Tiger Market' : 'You are selling to Tiger Market';
  return ['### 🧮 Automatic Spawner Price Calculation', `**${action}**`, `**Spawner:** ${result.spawnerLabel}`, `**Amount:** ${result.quantity.toLocaleString()}`, `**Price per spawner:** ${result.unitPriceFormatted}`, `**Price tier:** ${result.tier === '64' ? '64+ rate' : '3+ rate'}`, `### 💰 **Total: ${result.totalFormatted}**`, '', 'This total was calculated automatically from the current prices in the spawner price system.'].join('\n');
}

export function buildSpawnerMultiCalculationMessage(results) {
  const total = results.reduce((sum, result) => sum + result.total, 0);
  const lines = ['### 🧮 Automatic Spawner Price Calculation', `**${results[0]?.trade === 'buy' ? 'You are buying from Tiger Market' : 'You are selling to Tiger Market'}**`, ''];
  for (const result of results) lines.push(`**${result.spawnerLabel}:** ${result.quantity.toLocaleString()} × ${result.unitPriceFormatted} = **${result.totalFormatted}**`);
  lines.push('', `### 💰 **Grand Total: ${formatResult(total)}**`, '', 'This total was calculated automatically from the current prices in the spawner price system.');
  return lines.join('\n');
}
