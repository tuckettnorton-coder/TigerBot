import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getTicketFromChannel, isStaffForTicket } from '../../services/ticketService.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';

export default {
  name: 'ticket_calculate',
  async execute(interaction) {
    const ticket = getTicketFromChannel(interaction.channel);
    const definition = ticket?.typeId ? TICKET_TYPES[ticket.typeId] : null;

    if (!ticket || !definition || !isStaffForTicket(interaction.member, definition)) {
      await interaction.reply({ content: '❌ Only the support team can use the ticket calculator.', ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId('ticket_calc_type_modal')
      .setTitle('🧮 Donut SMP Calculator');

    const input = new TextInputBuilder()
      .setCustomId('expression')
      .setLabel('Type your calculation')
      .setPlaceholder('100M / 1000  or  100M/1000')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  },
};
