import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getPaidAdDraft, setPaidAdDraft } from '../../utils/paidAdDrafts.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';
import { clearTicketEphemeral, registerTicketEphemeral } from '../../utils/ticketEphemeral.js';

export default {
  name: 'paid_ad_giveaway_type',
  async execute(interaction) {
    const draft = getPaidAdDraft(interaction.user.id);
    if (!draft) return interaction.update({ content: '❌ Your advertisement session expired. Please start the ticket again.', components: [] });
    const type = interaction.values[0];
    const prices = loadPaidAdPrices();
    setPaidAdDraft(interaction.user.id, { giveaway: type, giveawayPrice: prices[type] });
    await clearTicketEphemeral(interaction.user.id);
    await interaction.update({ content: '### ⭐ Paid Advertisement\n**Do you want to extend your advertisement?**', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('paid_ad_extension').setPlaceholder('Extend your advertisement?').addOptions(
      new StringSelectMenuOptionBuilder().setLabel('No Extension').setDescription('Keep the selected plan duration').setValue('none'),
      new StringSelectMenuOptionBuilder().setLabel(`+3 Additional Days — $${prices.extend3}`).setDescription('Add 3 more days').setValue('extend3'),
      new StringSelectMenuOptionBuilder().setLabel(`+7 Additional Days — $${prices.extend7}`).setDescription('Add 7 more days').setValue('extend7'),
    ))] });
    registerTicketEphemeral(interaction.user.id, interaction);
  },
};