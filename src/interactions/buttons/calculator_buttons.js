import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { evaluateMathExpression } from '../../utils/safeMathParser.js';

const SUFFIXES = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

function normalize(expression) {
  return String(expression).replace(/,/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/([0-9]+(?:\.[0-9]+)?)([KMBT])\b/gi, (_, n, s) => `${Number(n) * SUFFIXES[s.toLowerCase()]}`);
}

function calculate(expression) {
  const normalized = normalize(expression);
  if (!/^[0-9+\-*/%^().\s]+$/.test(normalized)) throw new Error('Use numbers with K, M, B, T and +, -, ×, ÷.');
  return evaluateMathExpression(normalized);
}

function format(value) {
  const abs = Math.abs(value);
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [size, suffix] of units) if (abs >= size) return `${(value / size).toFixed(3).replace(/\.?(0+)$/, '')}${suffix}`;
  return Number(value.toFixed(6)).toLocaleString('en-US');
}

function rows() {
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

function embed(expression, result = null) {
  return new EmbedBuilder().setTitle('🧮 Donut SMP Calculator')
    .setDescription(`**Calculation**\n\`${expression || 'Start building a calculation below.'}\`\n\n**Result**\n### ${result === null ? '—' : format(result)}`)
    .setFooter({ text: 'TigerBot • Donut SMP Calculator' });
}

export default {
  name: 'calc_plus',
  async execute(interaction) {
    const id = interaction.customId;
    const current = interaction.message.embeds[0]?.description?.match(/\*\*Calculation\*\*\n`([^`]*)`/)?.[1] || '';
    const action = { calc_plus: ' + ', calc_minus: ' - ', calc_multiply: ' × ', calc_divide: ' ÷ ', calc_k: 'K', calc_m: 'M', calc_b: 'B', calc_t: 'T' };
    let expression = current === 'Start building a calculation below.' ? '' : current;
    if (id === 'calc_clear') expression = '';
    else expression += action[id] || '';
    let result = null;
    try { if (expression.trim()) result = calculate(expression); } catch {}
    await interaction.update({ embeds: [embed(expression, result)], components: rows() });
  },
};
