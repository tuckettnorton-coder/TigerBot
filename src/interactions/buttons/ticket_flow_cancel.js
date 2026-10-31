import { cancelTicketFlow } from '../../utils/ticketEphemeral.js';
import { clearShulkerDraft } from '../../utils/shulkerDrafts.js';

export default {
  name: 'ticket_flow_cancel',
  async execute(interaction) {
    await interaction.deferUpdate().catch(() => {});
    clearShulkerDraft(interaction.guildId, interaction.user.id);
    await cancelTicketFlow(interaction.user.id);
  },
};
