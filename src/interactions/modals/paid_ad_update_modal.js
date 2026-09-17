import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { loadPaidAdPrices, savePaidAdPrices, buildPaidAdPriceMessage, parsePaidAdPrice } from '../../utils/paidAdPricing.js';
import { PAID_AD_UPDATE_CHANNEL_ID } from '../../commands/Utility/paid-ad-update.js';

function input(id, label, value, placeholder) {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setValue(String(value)).setMaxLength(30).setPlaceholder(placeholder),
  );
}

export function buildPaidAdUpdateModal(prices = loadPaidAdPrices(), page = 1) {
  if (page === 2) {
    return new ModalBuilder().setCustomId('paid_ad_update_page2').setTitle('Paid Ad Prices • Page 2').addComponents(
      input('scheduled', 'Scheduled Posting Time', prices.scheduled, 'Example: 1'),
      input('nitro_premium', 'Nitro Premium Giveaway', prices.nitroPremium, 'Example: 12'),
      input('nitro_basic', 'Nitro Basic Giveaway', prices.nitroBasic, 'Example: 4'),
      input('extend_3', '+3 Additional Days', prices.extend3, 'Example: 1'),
      input('extend_7', '+7 Additional Days', prices.extend7, 'Example: 2'),
    );
  }
  return new ModalBuilder().setCustomId('paid_ad_update_page1').setTitle('Paid Ad Prices • Page 1').addComponents(
    input('premium', 'Premium Bundle', prices.premium, 'Example: 3'),
    input('standard', 'Standard Bundle', prices.standard, 'Example: 2'),
    input('basic', 'Basic Bundle', prices.basic, 'Example: 1'),
  );
}

const page1Handler = {
  name: 'paid_ad_update_page1',
  async execute(interaction) {
    try {
      const current = loadPaidAdPrices();
      const prices = {
        ...current,
        premium: parsePaidAdPrice(interaction.fields.getTextInputValue('premium'), 'Premium Bundle'),
        standard: parsePaidAdPrice(interaction.fields.getTextInputValue('standard'), 'Standard Bundle'),
        basic: parsePaidAdPrice(interaction.fields.getTextInputValue('basic'), 'Basic Bundle'),
      };
      savePaidAdPrices(prices);
      await interaction.showModal(buildPaidAdUpdateModal(prices, 2));
    } catch (error) {
      await interaction.reply({ content: `⚠️ **Paid ad update failed:** ${error.message}`, flags: MessageFlags.Ephemeral });
    }
  },
};

const page2Handler = {
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
      savePaidAdPrices(prices);
      const channel = await client.channels.fetch(PAID_AD_UPDATE_CHANNEL_ID).catch(() => null);
      if (!channel?.send) throw new Error(`Paid advertisement update channel ${PAID_AD_UPDATE_CHANNEL_ID} is not sendable.`);
      const oldId = current.messageId;
      if (oldId) await channel.messages.fetch(oldId).then((m) => m.delete()).catch(() => {});
      const sent = await channel.send({ content: buildPaidAdPriceMessage(prices) });
      savePaidAdPrices({ ...prices, messageId: sent.id });
      await interaction.reply({ content: `✅ **Paid Advertisement prices updated and posted in <#${PAID_AD_UPDATE_CHANNEL_ID}>.**`, flags: MessageFlags.Ephemeral });
    } catch (error) {
      await interaction.reply({ content: `⚠️ **Paid ad update failed:** ${error.message}`, flags: MessageFlags.Ephemeral });
    }
  },
};

export default [page1Handler, page2Handler];
