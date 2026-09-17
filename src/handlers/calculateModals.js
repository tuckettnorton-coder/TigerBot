import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { evaluateMathExpression } from '../utils/safeMathParser.js';
import { logger } from '../utils/logger.js';

const SUFFIXES = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

function normalizeMoneyExpression(expression) {
  return String(expression)
    .trim()
    .replace(/,/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/([0-9]+(?:\.[0-9]+)?)([KMBT])\b/gi, (_, number, suffix) => `${Number(number) * SUFFIXES[suffix.toLowerCase()]}`);
}

function calculate(expression) {
  const normalized = normalizeMoneyExpression(expression);
  if (!normalized || !/^[0-9+\-*/%^().\s]+$/.test(normalized)) {
    throw new Error('Use numbers, decimals, K, M, B, T and +, -, ×, ÷.');
  }
  return evaluateMathExpression(normalized);
}

function formatResult(value) {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 10 });
}

function calculatorButtons() {
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

function resultEmbed(expression, result) {
  return new EmbedBuilder()
    .setTitle('🧮 Donut SMP Calculator')
    .setDescription(`**Calculation**\n\`${expression}\`\n\n**Result**\n### ${formatResult(result)}`)
    .addFields({ name: 'Exact Value', value: `\`${formatResult(result)}\``, inline: true }, { name: 'Supported', value: '`K` Thousand\n`M` Million\n`B` Billion\n`T` Trillion', inline: true })
    .setFooter({ text: 'TigerBot • Donut SMP Calculator' });
}

async function calculateModalHandler(interaction, client, args = []) {
  try {
    if (interaction.customId === 'ticket_calc_modal') {
      const expression = interaction.fields.getTextInputValue('expression');
      const result = calculate(expression);
      await interaction.reply({ embeds: [resultEmbed(expression, result)], components: calculatorButtons() });
      return;
    }

    const operation = args[0];
    const operandInput = interaction.fields.first();
    const contextKey = operandInput?.customId?.split(':')[1];
    if (!contextKey) throw new Error('Failed to retrieve calculation context.');

    const { calculationContexts } = await import('../commands/Tools/calculate.js');
    const context = calculationContexts.get(contextKey);
    if (!context) throw new Error('This calculation has expired. Please start a new calculation.');

    const operand = interaction.fields.getTextInputValue(operandInput.customId);
    const newExpression = `(${context.expression}) ${context.operator} (${normalizeMoneyExpression(operand)})`;
    const newResult = evaluateMathExpression(newExpression);
    const formatted = formatResult(newResult);

    await interaction.deferReply();
    if (context.messageId && context.channelId) {
      const channel = await client.channels.fetch(context.channelId).catch(() => null);
      const message = channel ? await channel.messages.fetch(context.messageId).catch(() => null) : null;
      if (message) await message.edit({ embeds: [resultEmbed(newExpression, newResult)], components: calculatorButtons() }).catch(() => {});
    }
    calculationContexts.delete(contextKey);
    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('✅ Calculated').setDescription(`\`${newExpression}\` = \`${formatted}\``)] });
  } catch (error) {
    logger.error('Calculate modal handler error:', error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `❌ ${error.message}` }).catch(() => {});
    } else {
      await interaction.reply({ content: `❌ ${error.message}`, ephemeral: true }).catch(() => {});
    }
  }
}

export default { execute: calculateModalHandler };
