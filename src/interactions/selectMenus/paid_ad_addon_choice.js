import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getPaidAdDraft, setPaidAdDraft } from '../../utils/paidAdDrafts.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';
import { registerTicketEphemeral } from '../../utils/ticketEphemeral.js';

function moreMenu() {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('paid_ad_addon_more').setPlaceholder('Add another add-on?').addOptions(
    new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('Choose another add-on').setValue('yes').setEmoji('✅'),
    new StringSelectMenuOptionBuilder().setLabel('No').setDescription('Finish add-ons and choose payment').setValue('no').setEmoji('❌'),
  ));
}

export default {
  name: 'paid_ad_addon_choice',
  async execute(interaction) {
    const draft = getPaidAdDraft(interaction.user.id);
    if (!draft?.plan) return interaction.update({ content: '❌ Your advertisement session expired. Please start the ticket again.', components: [] });
    const value = interaction.values?.[0];
    const prices = loadPaidAdPrices();
    if (value === 'scheduled') {
      if (draft.plan === 'premium') return interaction.update({ content: '❌ Scheduled posting is already included with the Premium Bundle.', components: [] });
      await interaction.showModal((await import('../modals/paid_ad_schedule_modal.js')).buildPaidAdScheduleModal());
      return;
    }
    if (value === 'nitroPremium' || value === 'nitroBasic') {
      setPaidAdDraft(interaction.user.id, { giveaway: value, giveawayPrice: Number(prices[value] || 0) });
    } else if (value === 'extend3' || value === 'extend7') {
      setPaidAdDraft(interaction.user.id, { extension: value, extensionDays: value === 'extend3' ? 3 : 7, extensionPrice: Number(prices[value] || 0) });
    } else {
      return interaction.update({ content: '❌ Invalid add-on selected.', components: [] });
    }
    const label = value === 'nitroPremium' ? '💎 Nitro Premium Giveaway' : value === 'nitroBasic' ? '🚀 Nitro Basic Giveaway' : value === 'extend3' ? '+3 Additional Days' : '+7 Additional Days';
    await interaction.update({ content: `### ➕ Add-on selected\n**${label}** — $${Number(prices[value] || 0).toFixed(2)}\n\n**Do you want another add-on?**`, components: [moreMenu()] });
    registerTicketEphemeral(interaction.user.id, interaction);
  },
};