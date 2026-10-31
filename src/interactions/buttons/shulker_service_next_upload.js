import { MessageFlags } from 'discord.js';
import { getShulkerDraft } from '../../utils/shulkerDrafts.js';
import { buildShulkerUploadModal, getNextShulkerUpload, getShulkerUploadOrder } from '../selectMenus/shulker_service.js';

export default {
  name: 'shulker_service_next_upload',
  async execute(interaction, client, args = []) {
    const sessionId = args[0];
    const draft = getShulkerDraft(interaction.guildId, interaction.user.id, sessionId);
    if (!draft || draft.completing) {
      return interaction.reply({
        content: '❌ This Shulker Service upload step expired. Please start again.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const order = getShulkerUploadOrder(draft);
    const next = getNextShulkerUpload(draft);
    if (order.length !== 2 || !draft.screenshots?.[order[0]] || next !== order[1]) {
      return interaction.reply({
        content: '❌ Please complete the first screenshot before uploading the second.',
        flags: MessageFlags.Ephemeral,
      });
    }
    return interaction.showModal(buildShulkerUploadModal(draft, next));
  },
};
