import { EmbedBuilder } from 'discord.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';
import { closeTicket, getTicketFromChannel, isStaffForTicket, requestClose } from '../../services/ticketService.js';

async function safeError(interaction, message) {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content: `❌ ${message}` }).catch(() => {});
  } else {
    await interaction.reply({ content: `❌ ${message}`, ephemeral: true }).catch(() => {});
  }
}

export default [
  {
    name: 'ticket_claim',
    async execute(interaction) {
      try {
        const ticketData = getTicketFromChannel(interaction.channel);
        const ticket = ticketData && TICKET_TYPES[ticketData.typeId];
        if (!ticket) return safeError(interaction, 'This is not a managed ticket.');
        if (!isStaffForTicket(interaction.member, ticket)) return safeError(interaction, 'Only the ticket staff team can claim this ticket.');

        const metadata = { ...ticketData, claimedBy: interaction.user.id };
        await interaction.channel.setTopic(`tiger-ticket:${JSON.stringify(metadata)}`);
        await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`🔒 This ticket has been claimed by ${interaction.user}.`)] });
      } catch (error) {
        await safeError(interaction, error.message);
      }
    },
  },
  {
    name: 'ticket_close',
    async execute(interaction) {
      try {
        await interaction.deferReply({ ephemeral: true });
        const message = await requestClose(interaction.channel, interaction.member);
        await interaction.editReply(message ? '✅ Close request sent. The ticket opener can confirm it.' : 'A close request is already pending in this ticket.');
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
          return safeError(interaction, 'Only the ticket opener or ticket staff can confirm closure.');
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
          return safeError(interaction, 'Only the ticket opener or ticket staff can cancel closure.');
        }
        await interaction.update({ content: 'Close request cancelled.', embeds: [], components: [] });
      } catch (error) {
        await safeError(interaction, error.message);
      }
    },
  },
];
