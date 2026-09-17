import { MessageFlags } from 'discord.js';
import { loadPaidAdPrices, savePaidAdPrices, buildPaidAdPriceMessage, parsePaidAdPrice } from '../../utils/paidAdPricing.js';
import { PAID_AD_UPDATE_CHANNEL_ID } from '../../commands/Utility/paid-ad-update.js';

export default {
  name: 'paid_ad_update_page2',
  async execute(interaction, client) {
    try {
      const current = loadPaidAdPrices();
      const prices = {
        ...current,
        scheduled: parsePaidAdPrice(interaction.fields.getTextInputValue('scheduled'), 'Scheduled Posting Time'),
        nitroPremium: parsePaidAdPrice(interaction.fields.getTextInputValue('nitro_premium'), 'Nitro Premium Giveaway'),
        nitroBasic: parsePaidAdPrice(interaction.fields.getTextInputValue('nitro_basic'), 'Nitro Basic Giveaway'),
        extend3: parsePaidAdPrice(interaction.fields.getTextInputValue('extend_3'), '+3 Additional Days'),
        extend7: parsePaidAdPrice(interaction.fields.getTextInputValue('extend_7'), '+7 Additional Days'),
      };

      const channel = await client.channels.fetch(PAID_AD_UPDATE_CHANNEL_ID).catch(() => null);
      if (!channel || typeof channel.send !== 'function') {
        throw new Error(`Paid advertisement update channel ${PAID_AD_UPDATE_CHANNEL_ID} is not sendable.`);
      }

      if (current.messageId) {
        await channel.messages.fetch(current.messageId).then((message) => message.delete()).catch(() => {});
      }

      const sent = await channel.send({ content: buildPaidAdPriceMessage(prices) });
      savePaidAdPrices({ ...prices, messageId: sent.id });

      await interaction.reply({
        content: `✅ **Paid Advertisement prices updated and posted in <#${PAID_AD_UPDATE_CHANNEL_ID}>.**`,
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
