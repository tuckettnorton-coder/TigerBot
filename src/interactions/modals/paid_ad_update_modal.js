import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';

function input(id, label, value, placeholder) {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(String(value))
      .setMaxLength(30)
      .setPlaceholder(placeholder),
  );
}

export function buildPaidAdUpdateModal(prices = loadPaidAdPrices(), page = 1) {
  if (page === 2) {
    return new ModalBuilder()
      .setCustomId('paid_ad_update_page2')
      .setTitle('Paid Ad Prices • Page 2')
      .addComponents(
        input('scheduled', 'Scheduled Posting Time', prices.scheduled, 'Example: 1'),
        input('nitro_premium', 'Nitro Premium Giveaway', prices.nitroPremium, 'Example: 12'),
        input('nitro_basic', 'Nitro Basic Giveaway', prices.nitroBasic, 'Example: 4'),
        input('extend_3', '+3 Additional Days', prices.extend3, 'Example: 1'),
        input('extend_7', '+7 Additional Days', prices.extend7, 'Example: 2'),
      );
  }

  return new ModalBuilder()
    .setCustomId('paid_ad_update_page1')
    .setTitle('Paid Ad Prices • Page 1')
    .addComponents(
      input('premium', 'Premium Bundle', prices.premium, 'Example: 3'),
      input('standard', 'Standard Bundle', prices.standard, 'Example: 2'),
      input('basic', 'Basic Bundle', prices.basic, 'Example: 1'),
    );
}

export default { buildPaidAdUpdateModal };
