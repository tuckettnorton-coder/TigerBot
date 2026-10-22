import { MessageFlags } from 'discord.js';
import { persistPrices, postPrices, mergePrices } from '../../commands/Utility/spawner-update.js';
import { clearPendingSpawnerUpdate, getPendingSpawnerUpdate, parsePrices, SPAWNER_PRICE_PAGE_2_CONFIG } from './spawner_update_modal.js';

export default {
  name: 'spawner_price_page2',

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const pending = getPendingSpawnerUpdate(interaction);
      if (!pending) {
        throw new Error('Your spawner price update expired. Run /spawner-update again.');
      }

      const prices = mergePrices(pending);
      for (const { key, label } of SPAWNER_PRICE_PAGE_2_CONFIG) {
        prices[key] = parsePrices(interaction.fields.getTextInputValue(key), label);
      }

      persistPrices(prices);
      await postPrices(client, prices);
      clearPendingSpawnerUpdate(interaction);

      await interaction.editReply({
        content: '✅ **All 28 spawner prices have been updated and posted in <#1504948495948452001>.**',
      });
    } catch (error) {
      const response = {
        content: `⚠️ **Spawner price update failed:** ${error?.message || 'Unknown error.'}`,
      };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(response).catch(() => {});
      } else {
        await interaction.reply({ ...response, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  },
};
