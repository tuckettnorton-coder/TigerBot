import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { addTicketUser } from '../../services/ticketParticipantService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('add-ticket-user')
    .setDescription('Add a member to the current ticket with the same access as the ticket creator.')
    .setDMPermission(false)
    .addUserOption((option) => option
      .setName('user')
      .setDescription('The member to add to this ticket')
      .setRequired(true)),

  async execute(interaction) {
    try {
      const user = interaction.options.getUser('user', true);
      const result = await addTicketUser(interaction.channel, interaction.member, user);

      await interaction.reply({
        content: result.alreadyAdded
          ? `ℹ️ <@${user.id}> is already a member of this ticket.`
          : `✅ Added <@${user.id}> to this ticket. They now have the same channel access as the ticket creator.`,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { users: [user.id] },
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ ${error?.message || 'I could not add that member to the ticket.'}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    }
  },
};
