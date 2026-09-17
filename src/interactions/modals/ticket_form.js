import { createTicketChannel, logTicket } from '../../services/ticketService.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';

export default {
  name: 'ticket_form',
  async execute(interaction, client, args) {
    const typeId = args[0];
    const ticket = TICKET_TYPES[typeId];
    if (!ticket) return interaction.reply({ content: 'That ticket type is unavailable.', ephemeral: true });

    const answers = Object.fromEntries(ticket.form.map(field => [field.id, interaction.fields.getTextInputValue(field.id)]));
    await interaction.deferReply({ ephemeral: true });
    const result = await createTicketChannel({ guild: interaction.guild, user: interaction.user, typeId, answers });
    if (result.existing) return interaction.editReply(`You already have an open ticket: ${result.existing}`);
    await logTicket(interaction.guild, `🎫 **Ticket opened** • ${ticket.label} • ${interaction.user} • ${result.channel}`, client.config.ticket?.logChannelId || process.env.LOG_CHANNEL_ID);
    await interaction.editReply(`Ticket created: ${result.channel}`);
  },
};
