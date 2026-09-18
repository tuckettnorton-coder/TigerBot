import { cancelTicketFlow } from '../../utils/ticketEphemeral.js';

export default {
  name: 'ticket_flow_cancel',
  async execute(interaction) {
    await interaction.deferUpdate().catch(() => {});
    await cancelTicketFlow(interaction.user.id);
  },
};
