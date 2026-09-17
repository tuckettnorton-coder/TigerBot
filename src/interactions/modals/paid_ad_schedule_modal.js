import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { setPaidAdDraft } from '../../utils/paidAdDrafts.js';
import { clearTicketEphemeral, registerTicketEphemeral } from '../../utils/ticketEphemeral.js';

export function buildPaidAdScheduleModal() {
  return new ModalBuilder().setCustomId('paid_ad_schedule_modal').setTitle('Scheduled Advertisement').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('scheduled_time').setLabel('When should it be posted?').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder('Example: Saturday at 5 PM PST')),
  );
}

export default {
  name: 'paid_ad_schedule_modal',
  async execute(interaction) {
    try {
      const scheduledTime = interaction.fields.getTextInputValue('scheduled_time').trim();
      if (!scheduledTime) throw new Error('Please enter a scheduled posting time.');
      setPaidAdDraft(interaction.user.id, { scheduled: true, scheduledTime });
      await clearTicketEphemeral(interaction.user.id);
      await interaction.reply({ content: '### 💰 Paid Advertisement\n**Do you want to add a giveaway?**', components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('paid_ad_giveaway').setPlaceholder('Add a giveaway?').addOptions(new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('Add a Nitro giveaway').setValue('yes').setEmoji('🎁'), new StringSelectMenuOptionBuilder().setLabel('No').setDescription('No giveaway').setValue('no').setEmoji('❌')))], ephemeral: true });
      registerTicketEphemeral(interaction.user.id, interaction);
    } catch (error) {
      await interaction.reply({ content: `❌ ${error.message}`, flags: MessageFlags.Ephemeral });
    }
  },
};
