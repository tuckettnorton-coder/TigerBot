import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits,
} from 'discord.js';
import { TICKET_TYPES } from '../config/ticketTypes.js';

const OPEN_MARKER = 'tiger-ticket:';

function roleByName(guild, name) { return guild.roles.cache.find(r => r.name === name) || null; }
export function resolveRoles(guild, names) { return names.map(name => roleByName(guild, name)).filter(Boolean); }
function categoryByName(guild, name) { return guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === name.toLowerCase()); }
export function isStaffForTicket(member, ticket) {
  if (!member || !ticket) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return resolveRoles(member.guild, ticket.pingRoles).some(role => member.roles.cache.has(role.id));
}
export function getTicketFromChannel(channel) {
  if (!channel?.topic?.startsWith(OPEN_MARKER)) return null;
  try { return JSON.parse(channel.topic.slice(OPEN_MARKER.length)); } catch { return null; }
}
function ticketName(user, code) {
  const clean = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 18) || 'user';
  return `ticket-${clean}-${code}`;
}
export async function findExistingTicket(guild, userId, categoryName) {
  return guild.channels.cache.find(channel => {
    const ticket = getTicketFromChannel(channel);
    return ticket?.openerId === userId && ticket?.categoryName?.toLowerCase() === categoryName.toLowerCase();
  }) || null;
}
export async function createTicketChannel({ guild, user, typeId, answers = {} }) {
  const ticket = TICKET_TYPES[typeId];
  if (!ticket) throw new Error('Unknown ticket type.');
  const existing = await findExistingTicket(guild, user.id, ticket.categoryName);
  if (existing) return { existing };
  const category = categoryByName(guild, ticket.categoryName);
  if (!category) throw new Error(`Ticket category "${ticket.categoryName}" was not found.`);
  const roles = resolveRoles(guild, ticket.pingRoles);
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const metadata = { typeId, openerId: user.id, categoryName: ticket.categoryName, claimedBy: null, code, createdAt: new Date().toISOString() };
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
    ...roles.map(role => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] })),
  ];
  const channel = await guild.channels.create({ name: ticketName(user, code), type: ChannelType.GuildText, parent: category.id, topic: `${OPEN_MARKER}${JSON.stringify(metadata)}`, permissionOverwrites: overwrites, reason: `Ticket opened by ${user.tag} (${ticket.label})` });
  const mentions = roles.map(r => `<@&${r.id}>`).join(' ');
  const welcome = new EmbedBuilder().setTitle(ticket.label)
    .setDescription(`Welcome ${user}! ${mentions || 'Staff'} will get to you shortly.`)
    .addFields({ name: 'Ticket Code', value: `\`${code}\`` })
    .setFooter({ text: `Ticket • ${typeId}` });
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger),
  );
  await channel.send({ content: `${user} ${mentions}`.trim(), embeds: [welcome], components: [buttons] });
  if (Object.keys(answers).length) {
    const answerFields = ticket.form.map(field => ({ name: field.label, value: String(answers[field.id] ?? '—').slice(0, 1024) }));
    await channel.send({ embeds: [new EmbedBuilder().setTitle('Ticket Form').addFields(answerFields)] });
  }
  return { channel, metadata };
}
export async function requestClose(channel, member) {
  const ticket = getTicketFromChannel(channel);
  if (!ticket) throw new Error('This channel is not a managed ticket.');
  const definition = TICKET_TYPES[ticket.typeId];
  if (!isStaffForTicket(member, definition)) throw new Error('Only the ticket staff team can request a close.');
  const embed = new EmbedBuilder().setTitle('Close Request')
    .setDescription(`Staff member ${member} has requested to close this ticket\n<@${ticket.openerId}>`)
    .addFields({ name: 'Confirmation', value: 'Would you like to close this ticket?' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Confirm').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );
  return channel.send({ embeds: [embed], components: [row] });
}
async function fetchAllMessages(channel) {
  const all = []; let before;
  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!batch.size) break;
    all.push(...batch.values()); before = batch.last().id;
    if (batch.size < 100) break;
  }
  return all.reverse();
}
export async function closeTicket(channel, actor, transcriptChannelId) {
  const messages = await fetchAllMessages(channel);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(channel.name)}</title><style>body{font-family:Arial;background:#111;color:#eee;padding:24px}article{padding:12px;border-bottom:1px solid #333}small{color:#aaa}pre{white-space:pre-wrap;font:inherit}</style></head><body><h1>${escapeHtml(channel.name)}</h1><p>Closed by ${escapeHtml(actor.tag)} • ${new Date().toISOString()}</p>${messages.map(m => `<article><b>${escapeHtml(m.author.tag)}</b> <small>${m.createdAt.toISOString()}</small><pre>${escapeHtml(m.content || '[embed/attachment]')}</pre></article>`).join('')}</body></html>`;
  const transcript = new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `${channel.name}.html` });
  const transcriptChannel = transcriptChannelId ? channel.guild.channels.cache.get(transcriptChannelId) : null;
  if (transcriptChannel?.isTextBased()) await transcriptChannel.send({ content: `Transcript for **${channel.name}** • closed by ${actor}`, files: [transcript] });
  await channel.delete(`Ticket closed by ${actor.tag}`);
  return true;
}
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
export async function logTicket(guild, message, logChannelId) {
  const channel = logChannelId ? guild.channels.cache.get(logChannelId) : null;
  if (channel?.isTextBased()) await channel.send(message).catch(() => {});
}
