import { MessageFlags } from 'discord.js';
import {
  parseSubmittedPrices,
  persistPrices,
  postPrices,
} from '../../commands/Utility/spawner-update.js';

export default {
  name: 'spawner_update_modal',

  async execute(interaction, client) {
    const prices = parseSubmittedPrices(interaction);

    // Save first so the next /spawner-update modal opens with the new prices.
    persistPrices(prices);

    try {
      await postPrices(client, prices);
    } catch (error) {
      // Do not lose the submitted prices if Discord cannot be reached or the
      // configured channel is unavailable. The values are already persisted.
      await interaction.reply({
        content: `⚠️ Prices were saved, but I couldn't post the updated price list.\n\`${error.message}\``,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: '✅ Spawner prices updated, saved, and posted to the spawner-prices channel.',
      flags: MessageFlags.Ephemeral,
    });
  },
};
