import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

const SUFFIX_MULTIPLIERS = Object.freeze({
  K: 1_000,
  M: 1_000_000,
  B: 1_000_000_000,
  T: 1_000_000_000_000,
});

export function parseAmount(raw) {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim().replace(/\s+/g, '');
  if (!cleaned) return null;

  const match = cleaned.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))([kmbt])?$/i);
  if (!match) return null;

  const numberPart = Number(match[1]);
  if (!Number.isFinite(numberPart)) return null;

  const suffix = match[2]?.toUpperCase();
  const value = numberPart * (suffix ? SUFFIX_MULTIPLIERS[suffix] : 1);
  return Number.isFinite(value) ? value : null;
}

export function parseOperation(raw) {
  if (!raw) return null;
  const op = String(raw).trim().toLowerCase().replace(/\s+/g, '');
  if (['+', 'add', 'plus'].includes(op)) return '+';
  if (['-', 'sub', 'subtract', 'minus'].includes(op)) return '-';
  if (['*', 'x', 'times', 'multiply', 'mult', '×'].includes(op)) return '*';
  if (['/', 'div', 'divide', '÷'].includes(op)) return '/';
  return null;
}

function trimZeros(num) {
  if (!Number.isFinite(num)) return String(num);
  return Number(num.toFixed(12)).toString();
}

export function formatResult(value) {
  if (!Number.isFinite(value)) return String(value);
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000_000) return `${sign}${trimZeros(abs / 1_000_000_000_000)}T`;
  if (abs >= 1_000_000_000) return `${sign}${trimZeros(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sign}${trimZeros(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${trimZeros(abs / 1_000)}K`;
  return `${sign}${trimZeros(abs)}`;
}

export function calculateValues(value1, operation, value2) {
  switch (operation) {
    case '+': return value1 + value2;
    case '-': return value1 - value2;
    case '*': return value1 * value2;
    case '/':
      if (value2 === 0) throw new Error('Cannot divide by zero.');
      return value1 / value2;
    default:
      throw new Error('Invalid operation.');
  }
}

export function buildCalculatorModal() {
  const modal = new ModalBuilder().setCustomId('calculate_modal').setTitle('🧮 Calculator');

  const value1Input = new TextInputBuilder()
    .setCustomId('calc_value1')
    .setLabel('Value 1 (5k, 2.5m, 100)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('5k')
    .setRequired(true);

  const operationInput = new TextInputBuilder()
    .setCustomId('calc_operation')
    .setLabel('Operation (+ - × /)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('+')
    .setRequired(true);

  const value2Input = new TextInputBuilder()
    .setCustomId('calc_value2')
    .setLabel('Value 2 (5k, 2.5m, 100)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('3k')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(value1Input),
    new ActionRowBuilder().addComponents(operationInput),
    new ActionRowBuilder().addComponents(value2Input),
  );

  return modal;
}
