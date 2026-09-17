import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getPaidAdDraft, setPaidAdDraft } from '../../utils/paidAdDrafts.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';
import { clearTicketEphemeral, registerTicketEphemeral } from '../../utils/ticketEphemeral.js';

function extensionMenu() {
  const p = loadPaidAdPrices();
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('paid_ad_extension').setPlaceholder('Extend your advertisement?').addOptions(
    new StringSelectMenuOptionBuilder().setLabel('No Extension').setDescription('Keep the selected plan duration').setValue('none'),
    new StringSelectMenuOptionBuilder().setLabel(`+3 Additional Days — $${p.extend3}`).setDescription('Add 3 more days').setValue('extend3'),
    new StringSelectMenuOptionBuilder().setLabel(`+7 Additional Days — $${p.extend7}`).setDescription('Add 7 more days').setValue('extend7'),
  ));
}

export default {
  name: 'paid_ad_giveaway',
  async execute(interaction) {
    const draft = getPaidAdDraft(interaction.user.id);
    if (!draft) return interaction.update({ content: '❌ Your advertisement session expired. Please start the ticket again.', components: [] });
    const value = interaction.values[0];
    if (value === 'yes') {
      await interaction.update({ content: '### 🎁 Paid Advertisement\n**Which giveaway would you like to add?**', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('paid_ad_giveaway_type').setPlaceholder('Choose giveaway').addOptions(
        new StringSelectMenuOptionBuilder().setLabel(`💎 Nitro Premium — $${loadPaidAdPrices().nitroPremium}`).setDescription('Nitro Premium giveaway').setValue('nitroPremium'),
        new StringSelectMenuOptionBuilder().setLabel(`🚀 Nitro Basic — $${loadPaidAdPrices().nitroBasic}`).setDescription('Nitro Basic giveaway').setValue('nitroBasic'),
      ))] });
      registerTicketEphemeral(interaction.user.id, interaction);
      return;
    }
    setPaidAdDraft(interaction.user.id, { giveaway: 'none', giveawayPrice: 0 });
    await clearTicketEphemeral(interaction.user.id);
    await interaction.update({ content: '### ⭐ Paid Advertisement\n**Do you want to extend your advertisement?**', components: [extensionMenu()] });
    registerTicketEphemeral(interaction.user.id, interaction);
  },
};