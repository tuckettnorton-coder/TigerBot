import { TICKET_TYPES } from '../../config/ticketTypes.js';
import { closeTicket, getTicketFromChannel, isStaffForTicket, requestClose } from '../../services/ticketService.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

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
        if (!isStaffForTicket(interaction.member, TICKET_TYPES[ticket.typeId])) {
          return safeError(interaction, 'Only members with a support team role for this ticket can add members.');
        }

        const modal = new ModalBuilder()
          .setCustomId('ticket_add_user_modal')
          .setTitle('Add User to Ticket');

        const userInput = new TextInputBuilder()
          .setCustomId('ticket_add_user_input')
          .setLabel('User ID or @mention')
          .setPlaceholder('Example: 123456789012345678 or @username')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(30);

        modal.addComponents(new ActionRowBuilder().addComponents(userInput));
        await interaction.showModal(modal);
      } catch (error) {
        await safeError(interaction, error.message);
      }
    },
  },
];
