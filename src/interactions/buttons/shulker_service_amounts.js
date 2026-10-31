import { MessageFlags } from 'discord.js';
import { getShulkerDraft } from '../../utils/shulkerDrafts.js';
import { buildShulkerAmountsModal } from '../modals/shulker_service_quantity.js';
import { getShulkerUploadOrder } from '../selectMenus/shulker_service.js';

export default {
  name: 'shulker_service_amounts',
  async execute(interaction, client, args = []) {
    const sessionId = args[0];
    const draft = getShulkerDraft(interaction.guildId, interaction.user.id, sessionId);
    if (!draft || draft.completing || !getShulkerUploadOrder(draft).length
      || Object.keys(draft.screenshots || {}).length) {
      return interaction.reply({
        content: '❌ This Shulker Service quantity step is unavailable. Please start again.',
        flags: MessageFlags.Ephemeral,
      });
    }
    return interaction.showModal(buildShulkerAmountsModal(draft));
  },
};
