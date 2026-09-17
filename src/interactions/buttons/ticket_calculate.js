import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getTicketFromChannel, isStaffForTicket } from '../../services/ticketService.js';

function calculatorRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_calc_7').setLabel('7').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_calc_8').setLabel('8').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_calc_9').setLabel('9').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_calc_divide').setLabel('÷').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_calc_m').setLabel('M').setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_calc_4').setLabel('4').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_calc_5').setLabel('5').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_calc_6').setLabel('6').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_calc_multiply').setLabel('×').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_calc_b').setLabel('B').setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_calc_1').setLabel('1').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_calc_2').setLabel('2').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_calc_3').setLabel('3').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_calc_minus').setLabel('−').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_calc_k').setLabel('K').setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_calc_0').setLabel('0').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_calc_decimal').setLabel('.').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_calc_plus').setLabel('+').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_calc_t').setLabel('T').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_calc_clear').setLabel('Clear').setStyle(ButtonStyle.Danger),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_calc_backspace').setLabel('⌫').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_calc_enter').setLabel('Enter').setStyle(ButtonStyle.Success),
    ),
  ];
}

function panelEmbed(expression = '', result = null) {
  return new EmbedBuilder()
    .setTitle('🧮 Donut SMP Calculator')
    .setDescription(`**Enter a calculation using the buttons below.**\n\n**Calculation**\n\`${expression || '—'}\`\n\n**Result**\n### ${result ?? '—'}`)
    .setFooter({ text: 'TigerBot • Private calculator • Support only' });
}

export default {
  name: 'ticket_calculate',
  async execute(interaction) {
    const ticket = getTicketFromChannel(interaction.channel);
    const definition = ticket?.typeId ? interaction.client?.ticketTypes?.[ticket.typeId] : null;

    if (!ticket) {
      await interaction.reply({ content: '❌ This button can only be used inside a TigerBot ticket.', ephemeral: true });
      return;
    }

    const { TICKET_TYPES } = await import('../../config/ticketTypes.js');
    const ticketDefinition = TICKET_TYPES[ticket.typeId] || { pingRoles: [], accessRoles: [] };
    if (!isStaffForTicket(interaction.member, ticketDefinition)) {
      await interaction.reply({ content: '❌ Only the support team can use the calculator in tickets.', ephemeral: true });
      return;
    }

    await interaction.reply({
      ephemeral: true,
      embeds: [panelEmbed()],
      components: calculatorRows(),
    });
  },
};
