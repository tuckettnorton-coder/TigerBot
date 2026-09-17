import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getPaidAdDraft, setPaidAdDraft } from '../../utils/paidAdDrafts.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';
import { registerTicketEphemeral } from '../../utils/ticketEphemeral.js';

function buildAddonsYesNo() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('paid_ad_addons').setPlaceholder('Do you want any add-ons?').addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('Choose from the available add-ons').setValue('yes').setEmoji('✅'),
      new StringSelectMenuOptionBuilder().setLabel('No').setDescription('Continue without add-ons').setValue('no').setEmoji('❌'),
    ),
  );
}

export default {
  name: 'paid_ad_plan',
  async execute(interaction) {
    try {
      const draft = getPaidAdDraft(interaction.user.id);
      if (!draft) return interaction.update({ content: '❌ Your advertisement session expired. Please start the ticket again.', components: [] });
      const plan = interaction.values?.[0];
      const prices = loadPaidAdPrices();
      if (!['premium', 'standard', 'basic'].includes(plan)) return interaction.update({ content: '❌ Please choose a valid advertisement plan.', components: [] });
      const planPrice = Number(prices[plan] || 0);
      setPaidAdDraft(interaction.user.id, { plan, planPrice });
      await interaction.update({ content: `### 💰 Paid Advertisement\n**Plan selected:** ${plan === 'premium' ? '💎 Premium Bundle' : plan === 'standard' ? '🚀 Standard Bundle' : '📢 Basic Bundle'} — $${planPrice.toFixed(2)}\n\n**Do you want any add-ons?**\nChoose **Yes** to see the current add-ons and their prices.`, components: [buildAddonsYesNo()] });
      registerTicketEphemeral(interaction.user.id, interaction);
    } catch (error) {
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: `❌ Paid advertisement error: ${error.message}`, ephemeral: true }).catch(() => {});
    }
  },
};