import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { evaluateMathExpression } from '../../utils/safeMathParser.js';
import { getTicketFromChannel, isStaffForTicket } from '../../services/ticketService.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';

const SUFFIXES = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

export function normalize(expression) {
  let value = String(expression ?? '')
    .trim()
    .replace(/,/g, '')
    .replace(/[×xX]/g, '*')
    .replace(/[÷⁄]/g, '/')
    .replace(/−/g, '-');

  // Accept 100M, 100 M, 100m, 2.5B, etc., with or without spaces.
  value = value.replace(/([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*([KMBT])\b/gi, (_, number, suffix) => {
    return String(Number(number) * SUFFIXES[suffix.toUpperCase()]);
  });

  return value;
}

export function calculate(expression) {
  const raw = String(expression ?? '').trim();
  if (!raw) throw new Error('Type a calculation first. Example: 100M / 1000');

  const normalized = normalize(raw);
  try {
    const result = evaluateMathExpression(normalized);
    if (!Number.isFinite(result)) throw new Error('The calculation produced an invalid result.');
    return result;
  } catch (error) {
    throw new Error(`I could not calculate that. Try: 100M / 1000 or 100M/1000. ${error.message}`);
  }
}

export function formatResult(value) {
  for (const [size, suffix] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
    if (Math.abs(value) >= size) return `${(value / size).toFixed(3).replace(/\.?0+$/, '')}${suffix}`;
  }
  return Number(value.toFixed(6)).toLocaleString('en-US');
}

export function calculatorRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_calc_plus').setLabel('+').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_calc_minus').setLabel('−').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_calc_multiply').setLabel('×').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_calc_divide').setLabel('÷').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_calc_k').setLabel('K').setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_calc_m').setLabel('M').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_calc_b').setLabel('B').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_calc_t').setLabel('T').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_calc_backspace').setLabel('⌫').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_calc_clear').setLabel('Clear').setStyle(ButtonStyle.Danger),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_calc_type').setLabel('⌨️ Type / Edit').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_calc_enter').setLabel('Enter').setStyle(ButtonStyle.Success),
    ),
  ];
}

export function calculatorEmbed(expression = '', result = null) {
  return new EmbedBuilder()
    .setTitle('🧮 Donut SMP Calculator')
    .setDescription(`**Type normally with your keyboard using ⌨️ Type / Edit.**\nSpaces are optional. Use \\`/\\` for division.\n\n**Calculation**\n\`${expression || '—'}\`\n\n**Result**\n### ${result === null ? '—' : formatResult(result)}`)
    .setFooter({ text: 'TigerBot • Private calculator • Support only' });
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
  const additions = {
    ticket_calc_plus: ' + ',
    ticket_calc_minus: ' - ',
    ticket_calc_multiply: ' × ',
    ticket_calc_divide: ' / ',
    ticket_calc_k: 'K',
    ticket_calc_m: 'M',
    ticket_calc_b: 'B',
    ticket_calc_t: 'T',
  };

  if (id === 'ticket_calc_type') {
    const modal = new ModalBuilder().setCustomId('ticket_calc_type_modal').setTitle('🧮 Donut SMP Calculator');
    const input = new TextInputBuilder()
      .setCustomId('expression')
      .setLabel('Type your calculation')
      .setPlaceholder('100M / 1000  or  100M/1000')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);
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

const ids = ['ticket_calc_plus', 'ticket_calc_minus', 'ticket_calc_multiply', 'ticket_calc_divide', 'ticket_calc_k', 'ticket_calc_m', 'ticket_calc_b', 'ticket_calc_t', 'ticket_calc_clear', 'ticket_calc_backspace', 'ticket_calc_type', 'ticket_calc_enter'];
export default ids.map((name) => ({ name, execute }));
