import { EmbedBuilder } from 'discord.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';
import { closeTicket, getTicketFromChannel, isStaffForTicket, logTicket, requestClose } from '../../services/ticketService.js';

export default [
  {
    name: 'ticket_claim',
    async execute(interaction) {
      const ticketData = getTicketFromChannel(interaction.channel);
      const ticket = ticketData && TICKET_TYPES[ticketData.typeId];
      if (!ticket) return interaction.reply({ content: 'This is not a managed ticket.', ephemeral: true });
      if (!isStaffForTicket(interaction.member, ticket)) return interaction.reply({ content: 'Only the ticket staff team can claim tickets.', ephemeral: true });
      const claimed = interaction.channel.topic.replace('"claimedBy":null', `"claimedBy":"${interaction.user.id}"`);
      await interaction.channel.setTopic(claimed);
      await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`🔒 This ticket has been claimed by ${interaction.user}.`)] });
    },
  },
  {
    name: 'ticket_close',
    async execute(interaction) {
      await requestClose(interaction.channel, interaction.member);
    },
  },
  {
    name: 'ticket_close_confirm',
    async execute(interaction, client) {
      const ticket = getTicketFromChannel(interaction.channel);
      if (!ticket) return interaction.reply({ content: 'This ticket is no longer active.', ephemeral: true });
      const staff = isStaffForTicket(interaction.member, TICKET_TYPES[ticket.typeId]);
      if (interaction.user.id !== ticket.openerId && !staff) return interaction.reply({ content: 'Only the ticket opener or ticket staff can confirm closure.', ephemeral: true });
      await interaction.reply({ content: 'Saving transcript and closing ticket...', ephemeral: true });
      await logTicket(interaction.guild, `🔒 **Ticket closed** • ${TICKET_TYPES[ticket.typeId]?.label || ticket.typeId} • ${interaction.user} • #${interaction.channel.name}`, client.config.ticket?.logChannelId || process.env.LOG_CHANNEL_ID);
      await closeTicket(interaction.channel, interaction.user, client.config.ticket?.transcriptChannelId || process.env.TRANSCRIPT_CHANNEL_ID);
    },
  },
  {
    name: 'ticket_close_cancel',
    async execute(interaction) {
      const ticket = getTicketFromChannel(interaction.channel);
      if (!ticket) return interaction.reply({ content: 'This ticket is no longer active.', ephemeral: true });
      const staff = isStaffForTicket(interaction.member, TICKET_TYPES[ticket.typeId]);
      if (interaction.user.id !== ticket.openerId && !staff) return interaction.reply({ content: 'Only the ticket opener or ticket staff can cancel closure.', ephemeral: true });
      await interaction.update({ content: 'Close request cancelled.', embeds: [], components: [] });
    },
  },
];
