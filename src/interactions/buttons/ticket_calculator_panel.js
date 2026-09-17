import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { evaluateMathExpression } from '../../utils/safeMathParser.js';
import { getTicketFromChannel, isStaffForTicket } from '../../services/ticketService.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';

const SUFFIXES = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

export function normalize(expression) {
  return String(expression).trim().replace(/,/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/([+-]?(?:\d+(?:\.\d+)?|\.\d+))([KMBT])\b/gi, (_, number, suffix) => `${Number(number) * SUFFIXES[suffix.toUpperCase()]}`);
}

export function calculate(expression) {
  const normalized = normalize(expression);
  if (!normalized || !/^[0-9+\-*/%^().\s]+$/.test(normalized)) throw new Error('Enter a valid calculation using numbers, decimals, K, M, B, T and +, -, ×, ÷.');
  const result = evaluateMathExpression(normalized);
  if (!Number.isFinite(result)) throw new Error('The calculation produced an invalid result.');
  return result;
}

export function formatResult(value) {
  for (const [size, suffix] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
    if (Math.abs(value) >= size) return `${(value / size).toFixed(3).replace(/\.?(0+)$/, '')}${suffix}`;
  }
  return Number(value.toFixed(6)).toLocaleString('en-US');
}

export function calculatorRows() {
  return [
    new ActionRowBuilder().addComponents(...['7','8','9'].map((n) => new ButtonBuilder().setCustomId(`ticket_calc_${n}`).setLabel(n).setStyle(ButtonStyle.Secondary)), new ButtonBuilder().setCustomId('ticket_calc_divide').setLabel('÷').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('ticket_calc_m').setLabel('M').setStyle(ButtonStyle.Primary)),
    new ActionRowBuilder().addComponents(...['4','5','6'].map((n) => new ButtonBuilder().setCustomId(`ticket_calc_${n}`).setLabel(n).setStyle(ButtonStyle.Secondary)), new ButtonBuilder().setCustomId('ticket_calc_multiply').setLabel('×').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('ticket_calc_b').setLabel('B').setStyle(ButtonStyle.Primary)),
    new ActionRowBuilder().addComponents(...['1','2','3'].map((n) => new ButtonBuilder().setCustomId(`ticket_calc_${n}`).setLabel(n).setStyle(ButtonStyle.Secondary)), new ButtonBuilder().setCustomId('ticket_calc_minus').setLabel('−').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('ticket_calc_k').setLabel('K').setStyle(ButtonStyle.Primary)),
    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_calc_0').setLabel('0').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('ticket_calc_decimal').setLabel('.').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('ticket_calc_plus').setLabel('+').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('ticket_calc_t').setLabel('T').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('ticket_calc_clear').setLabel('Clear').setStyle(ButtonStyle.Danger)),
    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_calc_backspace').setLabel('⌫').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('ticket_calc_type').setLabel('⌨️ Type').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('ticket_calc_enter').setLabel('Enter').setStyle(ButtonStyle.Success)),
  ];
}

export function calculatorEmbed(expression = '', result = null) {
  return new EmbedBuilder().setTitle('🧮 Donut SMP Calculator').setDescription(`**Type with your keyboard using ⌨️ Type, or use the buttons below.**\n\n**Calculation**\n\`${expression || '—'}\`\n\n**Result**\n### ${result === null ? '—' : formatResult(result)}`).setFooter({ text: 'TigerBot • Private calculator • Support only' });
}

function getExpression(interaction) {
  return interaction.message?.embeds?.[0]?.description?.match(/\*\*Calculation\*\*\n`([^`]*)`/)?.[1] || '';
}

async function execute(interaction) {
  const ticket = getTicketFromChannel(interaction.channel);
  const definition = ticket?.typeId ? TICKET_TYPES[ticket.typeId] : null;
  if (!ticket || !definition || !isStaffForTicket(interaction.member, definition)) {
    await interaction.reply({ content: '❌ Only the support team can use the ticket calculator.', ephemeral: true });
    return;
  }

  let expression = getExpression(interaction);
  const id = interaction.customId;
  const additions = { ticket_calc_0:'0',ticket_calc_1:'1',ticket_calc_2:'2',ticket_calc_3:'3',ticket_calc_4:'4',ticket_calc_5:'5',ticket_calc_6:'6',ticket_calc_7:'7',ticket_calc_8:'8',ticket_calc_9:'9',ticket_calc_decimal:'.',ticket_calc_plus:' + ',ticket_calc_minus:' - ',ticket_calc_multiply:' × ',ticket_calc_divide:' ÷ ',ticket_calc_k:'K',ticket_calc_m:'M',ticket_calc_b:'B',ticket_calc_t:'T' };

  if (id === 'ticket_calc_type') {
    const modal = new ModalBuilder().setCustomId('ticket_calc_type_modal').setTitle('Donut SMP Calculator');
    const input = new TextInputBuilder().setCustomId('expression').setLabel('Type your calculation').setPlaceholder('100M / 1000   •   2.5B + 500M').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
    if (expression && expression !== '—') input.setValue(expression);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return;
  }

  if (id === 'ticket_calc_clear') expression = '';
  else if (id === 'ticket_calc_backspace') expression = expression.trimEnd().slice(0, -1).trimEnd();
  else if (id === 'ticket_calc_enter') {
    try {
      const result = calculate(expression);
      await interaction.update({ embeds: [calculatorEmbed(expression, result)], components: calculatorRows() });
    } catch (error) {
      await interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
    }
    return;
  } else if (additions[id]) expression += additions[id];

  await interaction.update({ embeds: [calculatorEmbed(expression)], components: calculatorRows() });
}

const ids = [...Array.from({ length: 10 }, (_, i) => `ticket_calc_${i}`), 'ticket_calc_decimal','ticket_calc_plus','ticket_calc_minus','ticket_calc_multiply','ticket_calc_divide','ticket_calc_k','ticket_calc_m','ticket_calc_b','ticket_calc_t','ticket_calc_clear','ticket_calc_backspace','ticket_calc_type','ticket_calc_enter'];
export default ids.map((name) => ({ name, execute }));
