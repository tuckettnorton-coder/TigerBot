import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getPaidAdDraft, setPaidAdDraft } from '../../utils/paidAdDrafts.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';
import { registerTicketEphemeral } from '../../utils/ticketEphemeral.js';

function addonMenu() {
  const p = loadPaidAdPrices();
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('paid_ad_addon_choice').setPlaceholder('Choose an add-on...').addOptions(
    new StringSelectMenuOptionBuilder().setLabel(`🕒 Scheduled Posting — $${Number(p.scheduled).toFixed(2)}`).setDescription('Choose a specific posting time').setValue('scheduled'),
    new StringSelectMenuOptionBuilder().setLabel(`🎁 Nitro Premium Giveaway — $${Number(p.nitroPremium).toFixed(2)}`).setDescription('Add a Nitro Premium giveaway').setValue('nitroPremium'),
    new StringSelectMenuOptionBuilder().setLabel(`🎁 Nitro Basic Giveaway — $${Number(p.nitroBasic).toFixed(2)}`).setDescription('Add a Nitro Basic giveaway').setValue('nitroBasic'),
    new StringSelectMenuOptionBuilder().setLabel(`+3 Additional Days — $${Number(p.extend3).toFixed(2)}`).setDescription('Extend the advertisement by 3 days').setValue('extend3'),
    new StringSelectMenuOptionBuilder().setLabel(`+7 Additional Days — $${Number(p.extend7).toFixed(2)}`).setDescription('Extend the advertisement by 7 days').setValue('extend7'),
  ));
}

function paymentMenu() {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('paid_ad_payment').setPlaceholder('Choose PayPal or Venmo').addOptions(
    new StringSelectMenuOptionBuilder().setLabel('PayPal').setDescription('Pay with PayPal').setValue('PayPal').setEmoji('💳'),
    new StringSelectMenuOptionBuilder().setLabel('Venmo').setDescription('Pay with Venmo').setValue('Venmo').setEmoji('💵'),
  ));
}

export default {
  name: 'paid_ad_addons',
  async execute(interaction) {
    const draft = getPaidAdDraft(interaction.user.id);
    if (!draft?.plan) return interaction.update({ content: '❌ Your advertisement session expired. Please start the ticket again.', components: [] });
    const value = interaction.values?.[0];
    if (value === 'no') {
      setPaidAdDraft(interaction.user.id, { scheduled: false, giveaway: 'none', extension: 'none', extensionDays: 0, scheduledPrice: 0, giveawayPrice: 0, extensionPrice: 0 });
      await interaction.update({ content: '### 💳 Paid Advertisement\n**Which payment method will you use?**', components: [paymentMenu()] });
      registerTicketEphemeral(interaction.user.id, interaction);
      return;
    }
    await interaction.update({ content: '### ➕ Paid Advertisement Add-ons\n**Choose an add-on below.**\n\nThe prices shown are the current prices from the Paid Advertisement pricing system.', components: [addonMenu()] });
    registerTicketEphemeral(interaction.user.id, interaction);
  },
};