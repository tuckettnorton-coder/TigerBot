import { MessageFlags } from 'discord.js';
import { loadPaidAdPrices, savePaidAdPrices, buildPaidAdPriceMessage, parsePaidAdPrice } from '../../utils/paidAdPricing.js';
import { getUpdateState, setUpdateState } from '../../utils/updateState.js';
import { upsertUpdateMessage } from '../../utils/updateMessage.js';
import { PAID_AD_UPDATE_CHANNEL_ID } from '../../commands/Utility/paid-ad-update.js';

export default {
  name: 'paid_ad_update_page2',
  async execute(interaction, client) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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

      const state = await getUpdateState(client, interaction.guildId);
      await upsertUpdateMessage({
        client,
        channel,
        content: buildPaidAdPriceMessage(prices),
        matches: (message) => (message.content || '').includes('# 💰 **Tiger Market Advertisement Prices**'),
        previousMessageIds: [current.messageId, state.paidAdPrices?.messageId],
        label: 'paid advertisement prices',
        onSaved: async (message) => {
          const savedPrices = { ...prices, messageId: message.id };
          savePaidAdPrices(savedPrices);
          await setUpdateState(client, interaction.guildId, { paidAdPrices: savedPrices });
        },
      });

      await interaction.editReply({
        content: `✅ **Paid Advertisement prices updated and posted in <#${PAID_AD_UPDATE_CHANNEL_ID}>.**`,
      });
    } catch (error) {
      const response = { content: `⚠️ **Paid ad update failed:** ${error?.message || 'Unknown error.'}` };
      if (interaction.deferred || interaction.replied) await interaction.editReply(response).catch(() => {});
      else await interaction.reply({ ...response, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  },
};
