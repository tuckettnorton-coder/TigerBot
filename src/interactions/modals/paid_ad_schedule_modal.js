import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } from 'discord.js';
import { setPaidAdDraft } from '../../utils/paidAdDrafts.js';
import { clearTicketEphemeral, registerTicketEphemeral } from '../../utils/ticketEphemeral.js';

function moreMenu() {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('paid_ad_addon_more').setPlaceholder('Add another add-on?').addOptions(
    new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('Choose another add-on').setValue('yes').setEmoji('✅'),
    new StringSelectMenuOptionBuilder().setLabel('No').setDescription('Finish add-ons and choose payment').setValue('no').setEmoji('❌'),
  ));
}

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
      setPaidAdDraft(interaction.user.id, { scheduled: true, scheduledTime, scheduledPrice: 0 });
      await interaction.reply({ content: '### ➕ Scheduled Posting Added\n**Do you want another add-on?**', components: [moreMenu()], ephemeral: true });
      await clearTicketEphemeral(interaction.user.id);
      registerTicketEphemeral(interaction.user.id, interaction);
    } catch (error) {
      await interaction.reply({ content: `❌ ${error.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  },
};