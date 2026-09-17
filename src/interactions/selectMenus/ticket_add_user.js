import { addTicketUser } from '../../services/ticketParticipantService.js';

export default {
  name: 'ticket_add_user_select',

  async execute(interaction) {
    try {
      // Acknowledge the User Select immediately so Discord never reports
      // "This interaction failed" while the permission API is processing.
      await interaction.deferUpdate();

      const userId = interaction.values?.[0];
      if (!userId) {
        await interaction.editReply({ content: '❌ No member was selected.', components: [] });
        return;
      }

      const member = await interaction.guild.members.fetch(userId);
      const result = await addTicketUser(interaction.channel, interaction.member, member.user);

      await interaction.editReply({
        content: result.alreadyAdded
          ? `ℹ️ <@${member.id}> is already a member of this ticket.`
          : `✅ Added <@${member.id}> to this ticket. They now have the same channel access as the ticket creator.`,
        components: [],
        allowedMentions: { users: [member.id] },
      });
    } catch (error) {
      const message = `❌ ${error?.message || 'I could not add that member to the ticket.'}`;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: message, components: [] }).catch(() => {});
      } else {
        await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
      }
    }
  },
};
