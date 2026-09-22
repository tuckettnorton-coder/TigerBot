import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { loadPaidAdPrices, savePaidAdPrices, parsePaidAdPrice } from '../../utils/paidAdPricing.js';
import { setUpdateState } from '../../utils/updateState.js';

export default {
  name: 'paid_ad_update_page1',
  async execute(interaction, client) {
    try {
      const current = loadPaidAdPrices();
      const prices = {
        ...current,
        premium: parsePaidAdPrice(interaction.fields.getTextInputValue('premium'), 'Premium Bundle'),
        standard: parsePaidAdPrice(interaction.fields.getTextInputValue('standard'), 'Standard Bundle'),
        basic: parsePaidAdPrice(interaction.fields.getTextInputValue('basic'), 'Basic Bundle'),
      };

      savePaidAdPrices(prices);
      await setUpdateState(client, interaction.guildId, { paidAdPrices: prices });

      await interaction.reply({
        content: '✅ **Page 1 saved.** Click **Continue to Page 2** to edit the remaining prices.',
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('paid_ad_update_continue')
              .setLabel('Continue to Page 2')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('➡️'),
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      await interaction.reply({
        content: `⚠️ **Paid ad update failed:** ${error?.message || 'Unknown error.'}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
