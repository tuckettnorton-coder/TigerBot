import { SlashCommandBuilder } from 'discord.js';

const SUFFIXES = {
  k: 1e3,
  m: 1e6,
  b: 1e9,
  t: 1e12,
};

function parseAmount(input) {
  const value = String(input).trim().toLowerCase().replace(/,/g, '');
  const match = value.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))([kmbt])?$/);

  if (!match) throw new Error(`Invalid number: **${input}**`);

  const number = Number(match[1]);
  const multiplier = match[2] ? SUFFIXES[match[2]] : 1;
  const result = number * multiplier;

  if (!Number.isFinite(result)) throw new Error('That number is too large.');
  return result;
}

function formatAmount(value) {
  if (!Number.isFinite(value)) return 'Too large';
  if (value === 0) return '0';

  const absolute = Math.abs(value);
  const units = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];

  for (const [size, suffix] of units) {
    if (absolute >= size) {
      const formatted = (value / size).toFixed(3).replace(/\.?(0+)$/, '');
      return `${formatted}${suffix}`;
    }
  }

  return Number(value.toFixed(3)).toLocaleString('en-US');
}

function formatExact(value) {
  return Number(value.toFixed(6)).toLocaleString('en-US', {
    maximumFractionDigits: 6,
  });
}

function calculateExpression(expression) {
  let normalized = expression
    .trim()
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/');

  if (!normalized) throw new Error('Enter a calculation.');

  // Supports +, -, *, / and parentheses while safely parsing K/M/B/T amounts.
  normalized = normalized.replace(
    /([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[kmbt])?)/gi,
    (token) => parseAmount(token).toString(),
  );

  if (!/^[0-9+\-*/().\s]+$/.test(normalized)) {
    throw new Error('Use numbers with K, M, B, T and operators +, -, ×, ÷.');
  }

  // Evaluate only after the expression has been reduced to numbers/operators.
  const result = Function(`"use strict"; return (${normalized})`)();

  if (!Number.isFinite(result)) throw new Error('The calculation produced an invalid result.');
  return result;
}

export default {
  data: new SlashCommandBuilder()
    .setName('calculate')
    .setDescription('Calculate Donut SMP-style money values using K, M, B and T')
    .addStringOption((option) =>
      option
        .setName('expression')
        .setDescription('Example: 100M / 1000, 2.5B + 500M, or 1.25T ÷ 1000')
        .setRequired(true),
    ),

  async execute(interaction) {
    const expression = interaction.options.getString('expression', true);

    try {
      const result = calculateExpression(expression);

      await interaction.reply({
        embeds: [
          {
            title: '🧮 Donut SMP Calculator',
            description: `**Calculation**\n\`${expression}\`\n\n**Result**\n### ${formatAmount(result)}`,
            fields: [
              {
                name: 'Exact Value',
                value: `\`${formatExact(result)}\``,
                inline: true,
              },
              {
                name: 'Supported',
                value: '`K` Thousand\n`M` Million\n`B` Billion\n`T` Trillion',
                inline: true,
              },
            ],
            footer: { text: 'TigerBot • Donut SMP Calculator' },
          },
        ],
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ ${error.message}\n\n**Examples:**\n• \`100M / 1000\` → 100K\n• \`2.5B + 500M\` → 3B\n• \`1.25T / 1000\` → 1.25B`,
        ephemeral: true,
      });
    }
  },
};
