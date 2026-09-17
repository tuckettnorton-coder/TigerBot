import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { setPaidAdDraft } from '../../utils/paidAdDrafts.js';
import { clearTicketEphemeral, registerTicketEphemeral } from '../../utils/ticketEphemeral.js';

function giveawayMenu() {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('paid_ad_giveaway').setPlaceholder('Add a giveaway?').addOptions(
    new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('Add a Nitro giveaway').setValue('yes').setEmoji('🎁'),
    new StringSelectMenuOptionBuilder().setLabel('No').setDescription('No giveaway').setValue('no').setEmoji('❌'),
  ));
}

export default {
  name: 'paid_ad_schedule',
  async execute(interaction) {
    const value = interaction.values[0];
    if (value === 'yes') {
      await interaction.showModal((await import('../modals/paid_ad_schedule_modal.js')).buildPaidAdScheduleModal());
      return;
    }
    setPaidAdDraft(interaction.user.id, { scheduled: false, scheduledTime: null });
    await clearTicketEphemeral(interaction.user.id);
    await interaction.update({ content: '### 💰 Paid Advertisement\n**Do you want to add a giveaway?**', components: [giveawayMenu()] });
    registerTicketEphemeral(interaction.user.id, interaction);
  },
};