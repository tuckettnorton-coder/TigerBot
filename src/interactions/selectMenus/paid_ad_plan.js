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
    const planPrice = Number(prices[plan] || 0);
    setPaidAdDraft(interaction.user.id, { plan, planPrice });
    await clearTicketEphemeral(interaction.user.id);
    await interaction.update({
      content: `### 💰 Paid Advertisement\n**Plan selected:** ${plan === 'premium' ? '💎 Premium Bundle' : plan === 'standard' ? '🚀 Standard Bundle' : '📢 Basic Bundle'} — $${planPrice.toFixed(2)}\n\n**Which payment method will you use?**`,
      components: [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('paid_ad_payment').setPlaceholder('Choose PayPal or Venmo').addOptions(
          new StringSelectMenuOptionBuilder().setLabel('PayPal').setDescription('Pay with PayPal').setValue('PayPal').setEmoji('💳'),
          new StringSelectMenuOptionBuilder().setLabel('Venmo').setDescription('Pay with Venmo').setValue('Venmo').setEmoji('💵'),
        ),
      )],
    });
    registerTicketEphemeral(interaction.user.id, interaction);
  },
};
