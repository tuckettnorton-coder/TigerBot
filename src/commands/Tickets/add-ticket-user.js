import { SlashCommandBuilder, MessageFlags } from 'discord.js';
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
    // A permission overwrite can take longer than Discord's 3-second
    // initial interaction window, so acknowledge the command immediately.
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const user = interaction.options.getUser('user', true);
      const result = await addTicketUser(interaction.channel, interaction.member, user);

      await interaction.editReply({
        content: result.alreadyAdded
          ? `ℹ️ <@${user.id}> is already a member of this ticket.`
          : `✅ Added <@${user.id}> to this ticket. They now have the same channel access as the ticket creator.`,
        allowedMentions: { users: [user.id] },
      });
    } catch (error) {
      const message = `❌ ${error?.message || 'I could not add that member to the ticket.'}`;

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: message }).catch(() => {});
      } else {
        await interaction.reply({
          content: message,
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
    }
  },
};
