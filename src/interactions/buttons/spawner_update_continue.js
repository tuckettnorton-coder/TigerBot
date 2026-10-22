import { MessageFlags } from 'discord.js';
import { buildSpawnerPriceModal, getPendingSpawnerUpdate } from '../modals/spawner_update_modal.js';

export default {
  name: 'spawner_update_continue',
  async execute(interaction) {
    const prices = getPendingSpawnerUpdate(interaction);
    if (!prices) {
      await interaction.reply({
        content: '⚠️ Your spawner price update expired. Run `/spawner-update` again.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.showModal(buildSpawnerPriceModal(prices, 2));
  },
};
