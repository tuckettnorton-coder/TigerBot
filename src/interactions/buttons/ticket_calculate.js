import { getTicketFromChannel, isStaffForTicket } from '../../services/ticketService.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';
import { calculatorRows, calculatorEmbed } from './ticket_calculator_panel.js';

export default {
  name: 'ticket_calculate',
  async execute(interaction) {
    const ticket = getTicketFromChannel(interaction.channel);
    if (!ticket) {
      await interaction.reply({ content: '❌ This button can only be used inside a TigerBot ticket.', ephemeral: true });
      return;
    }

    const ticketDefinition = TICKET_TYPES[ticket.typeId] || { pingRoles: [], accessRoles: [] };
    if (!isStaffForTicket(interaction.member, ticketDefinition)) {
      await interaction.reply({ content: '❌ Only the support team can use the calculator in tickets.', ephemeral: true });
      return;
    }

    await interaction.reply({ ephemeral: true, embeds: [calculatorEmbed()], components: calculatorRows() });
  },
};
