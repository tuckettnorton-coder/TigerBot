import { loadDiggingPrices } from '../commands/Utility/digging-update.js';
import { parseAmount, formatResult } from './calculator.js';

function parsePrice(value) {
  const parsed = parseAmount(String(value).replace(/[$,]/g, ''));
  if (parsed === null || parsed < 0) throw new Error(`Invalid digging price: ${value}`);
  return parsed;
}

function parseDimension(value) {
  const parsed = parseAmount(String(value).replace(/,/g, ''));
  if (parsed === null || parsed <= 0 || !Number.isInteger(parsed)) throw new Error(`Invalid area dimension: ${value}`);
  return parsed;
}

export function parseAreaDimensions(value) {
  const parts = String(value || '').trim().toLowerCase().replace(/[×*]/g, 'x').split(/\s*x\s*/).filter(Boolean);
  if (parts.length !== 3) throw new Error('Area size must be entered as width x length x height, for example 100 x 100 x 50.');
  const [width, length, height] = parts.map(parseDimension);
  const blocks = width * length * height;
  if (!Number.isSafeInteger(blocks)) throw new Error('The area is too large to calculate safely.');
  return { width, length, height, blocks };
}

export function calculateDiggingPrice({ areaSize, goodCoords, customRegion }) {
  const dimensions = parseAreaDimensions(areaSize);
  const data = loadDiggingPrices();
  const perBlock = parsePrice(data.prices.perBlock);
  const goodCoordsFee = goodCoords ? parsePrice(data.prices.goodCoords) : 0;
  const customRegionFee = customRegion ? parsePrice(data.prices.customRegion) : 0;
  const blockCost = dimensions.blocks * perBlock;
  const total = blockCost + goodCoordsFee + customRegionFee;

  return {
    ...dimensions,
    perBlock,
    perBlockFormatted: `$${formatResult(perBlock)}`,
    blockCost,
    blockCostFormatted: `$${formatResult(blockCost)}`,
    goodCoords: Boolean(goodCoords),
    goodCoordsFee,
    goodCoordsFeeFormatted: `$${formatResult(goodCoordsFee)}`,
    customRegion: Boolean(customRegion),
    customRegionFee,
    customRegionFeeFormatted: `$${formatResult(customRegionFee)}`,
    total,
    totalFormatted: `$${formatResult(total)}`,
  };
}

export function buildDiggingCalculationMessage(result) {
  return [
    '### 🧮 Automatic Digging Price Calculation',
    `**Area:** ${result.width.toLocaleString()} × ${result.length.toLocaleString()} × ${result.height.toLocaleString()}`,
    `**Total blocks:** ${result.blocks.toLocaleString()}`,
    `**Price per block:** ${result.perBlockFormatted}`,
    `**Block cost:** ${result.blockCostFormatted}`,
    `**Good coords:** ${result.goodCoords ? result.goodCoordsFeeFormatted : 'No charge'}`,
    `**Custom region:** ${result.customRegion ? result.customRegionFeeFormatted : 'No charge'}`,
    `### 💰 **Total: ${result.totalFormatted}**`,
    '',
    'This total uses the current prices saved by /digging-update.',
  ].join('\n');
}
