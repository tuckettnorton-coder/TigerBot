import { MessageFlags } from 'discord.js';
import {
  buildSpawnerModal,
  loadPrices,
  parseSpawnerSubmission,
  persistPrices,
  postPrices,
} from '../../commands/Utility/spawner-update.js';

// Discord modals allow a maximum of 5 action rows. Since we need 12 individual
// price fields (4 for each of 3 spawners), the editor walks through 3 modals:
// Skeleton -> Creeper -> Iron Golem. Each modal has 4 separate price boxes.
const drafts = new Map();

export default {
  name: 'spawner_update_modal',

  async execute(interaction, client, args = []) {
    const step = args[0] || 'skeleton';
    const userId = interaction.user.id;
    const currentPrices = loadPrices();

    if (step === 'skeleton') {
      const draft = {
        ...currentPrices,
        skeleton: parseSpawnerSubmission(interaction, 'skeleton', currentPrices.skeleton),
      };
      drafts.set(userId, draft);

      await interaction.showModal(buildSpawnerModal('creeper', draft));
      return;
    }

    if (step === 'creeper') {
      const draft = drafts.get(userId) || currentPrices;
      draft.creeper = parseSpawnerSubmission(interaction, 'creeper', draft.creeper);
      drafts.set(userId, draft);

      await interaction.showModal(buildSpawnerModal('irongolem', draft));
      return;
    }

    if (step === 'irongolem') {
      const draft = drafts.get(userId) || currentPrices;
      draft.irongolem = parseSpawnerSubmission(interaction, 'irongolem', draft.irongolem);
      drafts.delete(userId);

      // Save all 12 values first so the next command opens with the new prices.
      persistPrices(draft);

      try {
        await postPrices(client, draft);
      } catch (error) {
        await interaction.reply({
          content: `⚠️ All 12 prices were saved, but I couldn't post the updated price list.\n\`${error.message}\``,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.reply({
        content: '✅ All 12 spawner prices were updated, saved, and posted to the spawner-prices channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: '⚠️ Invalid spawner price update step. Please run `/spawner-update` again.',
      flags: MessageFlags.Ephemeral,
    });
  },
};
