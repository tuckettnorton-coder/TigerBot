import { PermissionFlagsBits } from 'discord.js';
import { TICKET_TYPES } from '../config/ticketTypes.js';
import { getTicketFromChannel, isStaffForTicket } from './ticketService.js';

const TICKET_MEMBER_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
];

function canManageParticipants(interaction, ticket) {
  if (!interaction?.member || !ticket) return false;
  return isStaffForTicket(interaction.member, TICKET_TYPES[ticket.typeId]);
}

export async function addTicketUser(channel, actor, user) {
  const ticket = getTicketFromChannel(channel);
  if (!ticket) throw new Error('This channel is not a managed ticket.');
  if (!user?.id) throw new Error('Please select a valid server member.');
  if (user.bot) throw new Error('Bots cannot be added as ticket members.');

  if (!isStaffForTicket(actor, TICKET_TYPES[ticket.typeId])) {
    throw new Error('Only members with a support team role for this ticket can add members.');
  }
  if (user.id === ticket.openerId) throw new Error('That member is already the ticket creator.');
  if (user.id === channel.guild.members.me?.id) throw new Error('I cannot add myself to the ticket.');

  const existing = channel.permissionOverwrites.cache.get(user.id);
  if (existing?.allow?.has(PermissionFlagsBits.ViewChannel)) {
    return { alreadyAdded: true, user };
  }

  await channel.permissionOverwrites.edit(user.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
    EmbedLinks: true,
  }, { reason: `Added to ticket by ${actor?.user?.tag || actor?.user?.username || actor?.user?.id || actor?.id || 'unknown'}` });

  return { alreadyAdded: false, user };
}

export { canManageParticipants, TICKET_MEMBER_PERMISSIONS };
