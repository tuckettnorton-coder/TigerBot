import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPrices } from '../commands/Utility/spawner-update.js';
import { parseAmount, formatResult } from './calculator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FEES_FILE = path.join(__dirname, '../commands/Utility/middlemanFees.json');

const DEFAULT_FEES = {
  spawnerFee: 50_000,
  bulkSpawnerFee: 25_000,
  bulkThreshold: 64,
  otherServicePercent: 10,
};

const LABELS = {
  skeleton: 'Skeleton',
  creeper: 'Creeper',
  irongolem: 'Iron Golem',
};

function cloneDefaults() {
  return { ...DEFAULT_FEES };
}

export function loadMiddlemanFees() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FEES_FILE, 'utf8'));
    return {
      ...DEFAULT_FEES,
      ...parsed,
    };
  } catch {
    return cloneDefaults();
  }
}

export function saveMiddlemanFees(fees) {
  fs.writeFileSync(FEES_FILE, `${JSON.stringify(fees, null, 2)}\n`, 'utf8');
}

function parsePrice(value) {
  const parsed = parseAmount(value);
  if (parsed === null || parsed < 0) throw new Error(`Invalid spawner price: ${value}`);
  return parsed;
}

export function calculateMiddlemanSpawner({ trade, spawnerType, amount }) {
  if (!['buy', 'sell'].includes(trade)) throw new Error('Choose Buy or Sell.');
  if (!LABELS[spawnerType]) throw new Error('Choose Skeleton, Creeper, or Iron Golem.');

  const quantity = Number(amount);
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Spawner quantity must be a whole number greater than 0.');

  const prices = loadPrices();
  const priceSet = prices[spawnerType];
  const tier = quantity >= 64 ? '64' : '3';
  const unitPrice = parsePrice(priceSet?.[`${trade}${tier}`]);
  const tradeValue = unitPrice * quantity;
  const fees = loadMiddlemanFees();
  const feePerSpawner = quantity >= Number(fees.bulkThreshold) ? Number(fees.bulkSpawnerFee) : Number(fees.spawnerFee);
  const middlemanFee = feePerSpawner * quantity;

  return {
    trade,
    spawnerType,
    spawnerLabel: LABELS[spawnerType],
    quantity,
    tier,
    unitPrice,
    tradeValue,
    feePerSpawner,
    middlemanFee,
    tradeValueFormatted: formatResult(tradeValue),
    unitPriceFormatted: formatResult(unitPrice),
    middlemanFeeFormatted: formatResult(middlemanFee),
  };
}

export function calculateMiddlemanOtherService(value) {
  const amount = typeof value === 'number' ? value : parseAmount(value);
  if (amount === null || !Number.isFinite(amount) || amount < 0) {
    throw new Error('Enter a valid money/value amount such as 100M, 1.5B, or 2500000.');
  }

  const fees = loadMiddlemanFees();
  const percent = Number(fees.otherServicePercent);
  const middlemanFee = amount * (percent / 100);

  return {
    value: amount,
    percent,
    middlemanFee,
    valueFormatted: formatResult(amount),
    middlemanFeeFormatted: formatResult(middlemanFee),
  };
}

export function buildMiddlemanSpawnerCalculationMessage(result) {
  return [
    '### 🤝 Automatic Middleman Fee Calculation',
    `**Spawner:** ${result.spawnerLabel}`,
    `**Buy/Sell:** ${result.trade === 'buy' ? 'Buy' : 'Sell'}`,
    `**Amount:** ${result.quantity.toLocaleString()}`,
    `**Current spawner price:** ${result.unitPriceFormatted} each`,
    `**Spawner price tier:** ${result.tier === '64' ? '64+ rate' : '3+ rate'}`,
    `**Total trade value:** ${result.tradeValueFormatted}`,
    `**Middleman fee:** ${result.feePerSpawner.toLocaleString()} per spawner`,
    `### 💰 **Total Middleman Fee: ${result.middlemanFeeFormatted}**`,
    '',
    'The spawner value is pulled from the current Tiger Market spawner prices, while the Middleman fee is pulled from the current Middleman fee settings.',
  ].join('\n');
}

export function buildMiddlemanOtherCalculationMessage(result) {
  return [
    '### 🤝 Automatic Middleman Fee Calculation',
    `**Total value involved:** ${result.valueFormatted}`,
    `**Middleman rate:** ${result.percent}%`,
    `### 💰 **Total Middleman Fee: ${result.middlemanFeeFormatted}**`,
    '',
    'The fee is calculated automatically from the current Middleman fee settings.',
  ].join('\n');
}

export function buildMiddlemanServiceMessage(fees) {
  const standard = Number(fees.spawnerFee);
  const bulk = Number(fees.bulkSpawnerFee);
  const threshold = Number(fees.bulkThreshold);
  const percent = Number(fees.otherServicePercent);

  return `<@&1528495941328441456>\n\n# 🤝 OFFICIAL MIDDLEMAN SERVICE\n\nWelcome to the Official Middleman Service! Our trusted Middlemen help keep your trades safe and secure.\n\n━━━━━━━━━━━━━━━━━━\n\n## 📋 HOW IT WORKS\n\n• To buy or sell any spawner or use a Middleman for another service, you must create a ticket.\n• Clearly state the items, amount, price, and full agreement in the ticket.\n• Both parties provide the agreed payment or items to the Middleman.\n• The Middleman holds everything securely until both sides complete their part of the deal.\n• Once everything is confirmed, the Middleman completes the transaction.\n\n━━━━━━━━━━━━━━━━━━\n\n## 💰 MIDDLEMAN FEES\n\n### Spawner Trades\n\n• **${formatResult(standard)} fee per spawner.**\n• **${formatResult(bulk)} fee per spawner** for **${threshold}+ spawners**.\n• The buyer, seller, or both parties can decide who pays the Middleman fee.\n• The bot automatically calculates the total fee using the current fee settings and current spawner prices.\n\n### Builds & Other Services\n\n• For builds or anything else requiring a Middleman, we charge **${percent}% of the total value being exchanged**.\n• Who pays the fee is entirely up to you and the other person involved in the deal.\n\n━━━━━━━━━━━━━━━━━━\n\n## 🧮 AUTOMATIC CALCULATIONS\n\n• Spawner trades use the current prices from the **Spawner Prices** system.\n• The bot calculates the total spawner value and the exact Middleman fee automatically.\n• Other services use the current **${percent}%** Middleman rate.\n\n━━━━━━━━━━━━━━━━━━\n\n## 🛡️ WHY USE A MIDDLEMAN?\n\n• Helps prevent scams.\n• Keeps payments and items secure.\n• Provides a trusted third party during transactions.\n• Helps ensure both sides receive exactly what was agreed.\n\n━━━━━━━━━━━━━━━━━━\n\n## ⚠️ IMPORTANT RULES\n\n• Only use official Middlemen from this server.\n• All official Middlemen are **Buyer/Seller+** and trusted by the server.\n• Do **NOT** trade without creating a ticket — unverified trades are not protected.\n• Make sure all agreements are clearly stated in the ticket.\n• Any attempt to scam may result in punishment and removal from the service.\n\n**No Middleman = Trade at your own risk.**\n\n━━━━━━━━━━━━━━━━━━\n\n## 🎫 READY TO START?\n\nHead over to <#1504949441650622575> and open a ticket to begin your safe Middleman trade today.`;
}
