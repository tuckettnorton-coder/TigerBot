import { PermissionFlagsBits } from 'discord.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';
import { getTicketFromChannel, isStaffForTicket } from '../../services/ticketService.js';
import { addTicketUser } from '../../services/ticketParticipantService.js';

function extractUserId(value) {
  return String(value || '').trim().replace(/[<@!>]/g, '');
}

export default {
  name: 'ticket_add_user_modal',

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const ticket = getTicketFromChannel(interaction.channel);
      if (!ticket) {
        await interaction.editReply('❌ This ticket is no longer active.');
        return;
      }

      const definition = TICKET_TYPES[ticket.typeId];
      if (!isStaffForTicket(interaction.member, definition)) {
        await interaction.editReply('❌ Only members with a support team role for this ticket can add members.');
        return;
      }

      const rawValue = interaction.fields.getTextInputValue('ticket_add_user_input');
      const userId = extractUserId(rawValue);

      if (!/^\d{17,20}$/.test(userId)) {
        await interaction.editReply('❌ Invalid user ID or mention. Please enter the Discord user ID or @mention.');
        return;
      }

      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!member) {
        await interaction.editReply('❌ I could not find that member in this server.');
        return;
      }

      const result = await addTicketUser(interaction.channel, interaction.member, member.user);

      await interaction.editReply(
        result.alreadyAdded
          ? `ℹ️ <@${member.id}> is already a member of this ticket.`
          : `✅ Added <@${member.id}> to this ticket. They now have the same channel access as the ticket creator.`,
      );
    } catch (error) {
      const message = `❌ ${error?.message || 'I could not add that member to the ticket.'}`;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(message).catch(() => {});
      } else {
        await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
      }
    }
  },
};
