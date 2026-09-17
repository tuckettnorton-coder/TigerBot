import { TICKET_TYPES } from '../../config/ticketTypes.js';
import { closeTicket, getTicketFromChannel, isStaffForTicket, requestClose } from '../../services/ticketService.js';
import { addTicketUser } from '../../services/ticketParticipantService.js';
import { ActionRowBuilder, UserSelectMenuBuilder } from 'discord.js';

async function safeError(interaction, message) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content: `❌ ${message}` }).catch(() => {});
  } else {
    await interaction.reply({ content: `❌ ${message}`, ephemeral: true }).catch(() => {});
  }
}

export default [
  {
    name: 'ticket_close',
    async execute(interaction) {
      try {
        const ticket = getTicketFromChannel(interaction.channel);
        if (!ticket) return safeError(interaction, 'This ticket is no longer active.');
        const staff = isStaffForTicket(interaction.member, TICKET_TYPES[ticket.typeId]);
        if (!staff) return safeError(interaction, 'Only ticket staff can request the ticket to be closed.');
        await interaction.deferReply({ ephemeral: true });
        const message = await requestClose(interaction.channel, interaction.member);
        await interaction.editReply(message ? '✅ Close request sent and the ticket owner has been pinged.' : 'A close request is already pending in this ticket.');
      } catch (error) {
        await safeError(interaction, error.message);
      }
    },
  },
  {
    name: 'ticket_close_confirm',
    async execute(interaction) {
      try {
        const ticket = getTicketFromChannel(interaction.channel);
        if (!ticket) return safeError(interaction, 'This ticket is no longer active.');
        const definition = TICKET_TYPES[ticket.typeId];
        const staff = isStaffForTicket(interaction.member, definition);
        if (interaction.user.id !== ticket.openerId && !staff) {
          return safeError(interaction, 'Only the ticket owner or ticket staff can confirm closure.');
        }
        await interaction.reply({ content: '📜 Saving transcript and closing ticket...', ephemeral: true });
        await closeTicket(interaction.channel, interaction.user);
      } catch (error) {
        await safeError(interaction, error.message);
      }
    },
  },
  {
    name: 'ticket_close_cancel',
    async execute(interaction) {
      try {
        const ticket = getTicketFromChannel(interaction.channel);
        if (!ticket) return safeError(interaction, 'This ticket is no longer active.');
        const staff = isStaffForTicket(interaction.member, TICKET_TYPES[ticket.typeId]);
        if (interaction.user.id !== ticket.openerId && !staff) {
          return safeError(interaction, 'Only the ticket owner or ticket staff can cancel the close request.');
        }
        await interaction.update({ content: 'Close request cancelled.', embeds: [], components: [] });
      } catch (error) {
        await safeError(interaction, error.message);
      }
    },
  },
  {
    name: 'ticket_add_user',
    async execute(interaction) {
      try {
        const ticket = getTicketFromChannel(interaction.channel);
        if (!ticket) return safeError(interaction, 'This ticket is no longer active.');
        const staff = isStaffForTicket(interaction.member, TICKET_TYPES[ticket.typeId]);
        if (!staff) {
          return safeError(interaction, 'Only members with a support team role for this ticket can add members.');
        }

        const userSelect = new UserSelectMenuBuilder()
          .setCustomId('ticket_add_user_select')
          .setPlaceholder('Select a member to add to this ticket')
          .setMinValues(1)
          .setMaxValues(1);

        await interaction.reply({
          content: '👤 **Add a member to this ticket**\nSelect the member below. They will receive the same channel access as the ticket creator.',
          components: [new ActionRowBuilder().addComponents(userSelect)],
          ephemeral: true,
        });
      } catch (error) {
        await safeError(interaction, error.message);
      }
    },
  },
];
