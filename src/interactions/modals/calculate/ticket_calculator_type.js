import { calculatorRows, calculatorEmbed, calculate } from '../../../buttons/ticket_calculator_panel.js';
import { getTicketFromChannel, isStaffForTicket } from '../../../../services/ticketService.js';
import { TICKET_TYPES } from '../../../../config/ticketTypes.js';

export default {
  name: 'ticket_calc_type_modal',
  async execute(interaction) {
    const ticket = getTicketFromChannel(interaction.channel);
    const definition = ticket?.typeId ? TICKET_TYPES[ticket.typeId] : null;

    if (!ticket || !definition || !isStaffForTicket(interaction.member, definition)) {
      await interaction.reply({ content: '❌ Only the support team can use the ticket calculator.', ephemeral: true });
      return;
    }

    const expression = interaction.fields.getTextInputValue('expression').trim();
    try {
      const result = calculate(expression);
      await interaction.reply({ ephemeral: true, embeds: [calculatorEmbed(expression, result)], components: calculatorRows() });
    } catch (error) {
      await interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
    }
  },
};
