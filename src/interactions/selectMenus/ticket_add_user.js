import { addTicketUser } from '../../services/ticketParticipantService.js';

export default {
  name: 'ticket_add_user_select',

  async execute(interaction) {
    try {
      const userId = interaction.values?.[0];
      if (!userId) {
        await interaction.update({ content: '❌ No member was selected.', components: [] });
        return;
      }

      const user = await interaction.guild.members.fetch(userId);
      const result = await addTicketUser(interaction.channel, interaction.member, user.user);

      await interaction.update({
        content: result.alreadyAdded
          ? `ℹ️ <@${user.id}> is already a member of this ticket.`
          : `✅ Added <@${user.id}> to this ticket. They now have the same channel access as the ticket creator.`,
        components: [],
        allowedMentions: { users: [user.id] },
      });
    } catch (error) {
      await interaction.update({
        content: `❌ ${error?.message || 'I could not add that member to the ticket.'}`,
        components: [],
      }).catch(() => {});
    }
  },
};
