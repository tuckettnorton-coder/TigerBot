import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';

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

  normalized = normalized.replace(
    /([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[kmbt])?)/gi,
    (token) => parseAmount(token).toString(),
  );

  if (!/^[0-9+\-*/().\s]+$/.test(normalized)) {
    throw new Error('Use numbers with K, M, B, T and operators +, -, ×, ÷.');
  }

  const result = Function(`"use strict"; return (${normalized})`)();

  if (!Number.isFinite(result)) throw new Error('The calculation produced an invalid result.');
  return result;
}

function calculatorRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('calc_plus').setLabel('+').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('calc_minus').setLabel('−').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('calc_multiply').setLabel('×').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('calc_divide').setLabel('÷').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('calc_k').setLabel('K').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('calc_m').setLabel('M').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('calc_b').setLabel('B').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('calc_t').setLabel('T').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('calc_clear').setLabel('Clear').setStyle(ButtonStyle.Danger),
    ),
  ];
}

function buildCalculatorEmbed(expression, result = null) {
  return new EmbedBuilder()
    .setTitle('🧮 Donut SMP Calculator')
    .setDescription(
      `**Calculation**\n\`${expression || 'Use the buttons below or enter an expression above.'}\`\n\n**Result**\n### ${result === null ? '—' : formatAmount(result)}`,
    )
    .addFields(
      {
        name: 'Exact Value',
        value: result === null ? '`—`' : `\`${formatExact(result)}\``,
        inline: true,
      },
      {
        name: 'Supported',
        value: '`K` Thousand\n`M` Million\n`B` Billion\n`T` Trillion',
        inline: true,
      },
    )
    .setFooter({ text: 'TigerBot • Donut SMP Calculator' });
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
        embeds: [buildCalculatorEmbed(expression, result)],
        components: calculatorRows(),
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ ${error.message}\n\n**Examples:**\n• \`100M / 1000\` → 100K\n• \`2.5B + 500M\` → 3B\n• \`1.25T / 1000\` → 1.25B`,
        ephemeral: true,
      });
    }
  },

  async handleButton(interaction) {
    const id = interaction.customId;
    const current = interaction.message.embeds[0]?.description?.match(/`([^`]*)`/)?.[1] || '';

    const actions = {
      calc_plus: ' + ',
      calc_minus: ' - ',
      calc_multiply: ' × ',
      calc_divide: ' ÷ ',
      calc_k: 'K',
      calc_m: 'M',
      calc_b: 'B',
      calc_t: 'T',
    };

    let expression = current === 'Use the buttons below or enter an expression above.' ? '' : current;

    if (id === 'calc_clear') {
      await interaction.update({
        embeds: [buildCalculatorEmbed('')],
        components: calculatorRows(),
      });
      return;
    }

    if (actions[id]) expression += actions[id];

    let result = null;
    try {
      if (expression.trim()) result = calculateExpression(expression);
    } catch {
      // Keep the expression visible while the user builds it.
    }

    await interaction.update({
      embeds: [buildCalculatorEmbed(expression, result)],
      components: calculatorRows(),
    });
  },
};
