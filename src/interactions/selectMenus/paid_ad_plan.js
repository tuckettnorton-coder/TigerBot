import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getPaidAdDraft, setPaidAdDraft } from '../../utils/paidAdDrafts.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';
import { clearTicketEphemeral, registerTicketEphemeral } from '../../utils/ticketEphemeral.js';

export default {
  name: 'paid_ad_plan',
  async execute(interaction) {
    const draft = getPaidAdDraft(interaction.user.id);
    if (!draft) return interaction.update({ content: '❌ Your advertisement session expired. Please start the ticket again.', components: [] });
    const plan = interaction.values[0];
    const prices = loadPaidAdPrices();
    setPaidAdDraft(interaction.user.id, { plan, planPrice: prices[plan] });
    await clearTicketEphemeral(interaction.user.id);
    await interaction.update({ content: `### 💰 Paid Advertisement\n**Plan selected:** ${plan === 'premium' ? '💎 Premium' : plan === 'standard' ? '🚀 Standard' : '📢 Basic'}\n\n**Do you want a scheduled posting time?**\nScheduled posting is an add-on and will be charged according to the current Paid Advertisement prices.`, components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('paid_ad_schedule').setPlaceholder('Choose Yes or No').addOptions(new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('Add a scheduled posting time').setValue('yes').setEmoji('✅'), new StringSelectMenuOptionBuilder().setLabel('No').setDescription('Post without scheduling').setValue('no').setEmoji('❌')))] });
    registerTicketEphemeral(interaction.user.id, interaction);
  },
};