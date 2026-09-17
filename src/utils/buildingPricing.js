import { loadBuildingPrices } from '../commands/Utility/building-update.js';
import { parseAmount, formatResult } from './calculator.js';
function price(value) { const n = parseAmount(String(value).replace(/[$,]/g, '')); if (n === null || n < 0) throw new Error(`Invalid building price: ${value}`); return n; }
export function calculateBuildingPrice({ isFarm, ahValue, dailyFarmAmount }) {
  const data = loadBuildingPrices();
  if (isFarm) {
    const daily = price(dailyFarmAmount); const days = Number(data.farmMultiplierDays) || 3; const total = daily * days;
    return { isFarm: true, dailyFarmAmount: daily, days, total, totalFormatted: formatResult(total) };
  }
  const value = price(ahValue); if (value <= 0) throw new Error('AH value must be greater than 0.');
  const step = 5_000_000; const surchargeRate = value < 200_000_000 ? price(data.under200) : price(data.over200); const steps = Math.ceil(value / step); const surcharge = steps * surchargeRate; const total = value + surcharge;
  return { isFarm: false, ahValue: value, surchargeRate, steps, surcharge, total, totalFormatted: formatResult(total) };
}
export function buildBuildingCalculationMessage(result) {
  if (result.isFarm) return ['### 🧮 Automatic Building Price Calculation','**Build type:** Farm',`**Farm earnings per day:** ${formatResult(result.dailyFarmAmount)}`,`**Farm build price:** ${result.days} × daily earnings`,`### 💰 **Total: ${result.totalFormatted}**`,'','This total uses the current prices saved by /building-update.'].join('\n');
  return ['### 🧮 Automatic Building Price Calculation','**Build type:** Non-Farm',`**AH value:** ${formatResult(result.ahValue)}`,`**Pricing tier:** ${result.ahValue < 200_000_000 ? 'Under 200M AH' : '201M+ AH'}`,`**Added per 5M:** ${formatResult(result.surchargeRate)}`,`**5M blocks charged:** ${result.steps}`,`**Build fee:** ${formatResult(result.surcharge)}`,`### 💰 **Total: ${result.totalFormatted}`,'','This total uses the current prices saved by /building-update.'].join('\n');
}
