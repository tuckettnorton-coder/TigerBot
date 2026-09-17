import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getPaidAdDraft, setPaidAdDraft } from '../../utils/paidAdDrafts.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';
import { clearTicketEphemeral, registerTicketEphemeral } from '../../utils/ticketEphemeral.js';

export default {
  name: 'paid_ad_extension',
  async execute(interaction) {
    const draft = getPaidAdDraft(interaction.user.id);
    if (!draft) return interaction.update({ content: '❌ Your advertisement session expired. Please start the ticket again.', components: [] });
    const extension = interaction.values[0];
    const prices = loadPaidAdPrices();
    const extensionDays = extension === 'extend3' ? 3 : extension === 'extend7' ? 7 : 0;
    const extensionPrice = extension === 'extend3' ? prices.extend3 : extension === 'extend7' ? prices.extend7 : 0;
    setPaidAdDraft(interaction.user.id, { extension, extensionDays, extensionPrice });
    await clearTicketEphemeral(interaction.user.id);
    await interaction.update({ content: '### 💳 Paid Advertisement\n**Which payment method will you use?**', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('paid_ad_payment').setPlaceholder('Choose PayPal or Venmo').addOptions(new StringSelectMenuOptionBuilder().setLabel('PayPal').setDescription('Pay with PayPal').setValue('PayPal'), new StringSelectMenuOptionBuilder().setLabel('Venmo').setDescription('Pay with Venmo').setValue('Venmo')))] });
    registerTicketEphemeral(interaction.user.id, interaction);
  },
};