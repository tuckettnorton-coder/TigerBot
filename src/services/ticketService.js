import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { TICKET_TYPES } from '../config/ticketTypes.js';
import { storeTranscript, bindTranscriptMessage } from './transcriptStore.js';

const LOG_CHANNEL_NAME = '📝│logs';
const TRANSCRIPT_CHANNEL_NAME = '📝│transcripts';

function roleByName(guild, name) {
  const value = String(name).trim();
  return guild.roles.cache.get(value) || guild.roles.cache.find((role) => role.name.toLowerCase() === value.toLowerCase()) || null;
}

export function resolveRoles(guild, names = []) {
  return [...new Set(names)].map((name) => roleByName(guild, name)).filter(Boolean);
}

function ticketDefinitionFromCategory(categoryName) {
  return Object.entries(TICKET_TYPES).find(([, ticket]) => ticket.categoryName.toLowerCase() === String(categoryName || '').toLowerCase())?.[0] || null;
}

export function isStaffForTicket(member, ticket) {
  if (!member || !ticket) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  const staffRoles = resolveRoles(member.guild, [
    ...(ticket.pingRoles || []),
    ...(ticket.accessRoles || []),
  ]);
  return staffRoles.some((role) => member.roles.cache.has(role.id));
}

export function getTicketFromChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildText) return null;
  const codeMatch = channel.name.match(/-(\d{4})$/);
  const code = codeMatch?.[1] || null;
  const categoryName = channel.parent?.name || null;
  const typeId = ticketDefinitionFromCategory(categoryName);
  const openerOverwrite = channel.permissionOverwrites?.cache.find((overwrite) => {
    if (overwrite.type !== 1) return false;
    if (!overwrite.allow?.has(PermissionFlagsBits.ViewChannel)) return false;
    return channel.guild.members.cache.has(overwrite.id) || /^\d+$/.test(overwrite.id);
  });

  if (!code || !categoryName || !openerOverwrite) return null;

  return { typeId, openerId: openerOverwrite.id, categoryName, claimedBy: null, code };
}

function categoryByName(guild, name) {
  return guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && channel.name.toLowerCase() === name.toLowerCase(),
  ) || null;
}

export async function ensureTicketCategories(guild) {
  const names = [...new Set(Object.values(TICKET_TYPES).map((ticket) => ticket.categoryName))];
  const categories = {};
  for (const name of names) {
    let category = categoryByName(guild, name);
    if (!category) category = await guild.channels.create({ name, type: ChannelType.GuildCategory, reason: 'TigerBot automatic ticket category setup' });
    categories[name] = category;
  }
  return categories;
}

async function findUtilityChannel(guild, name) {
  return guild.channels.cache.find(
    (candidate) => candidate.type === ChannelType.GuildText && candidate.name.toLowerCase() === name.toLowerCase(),
  ) || null;
}

export async function ensureTicketInfrastructure(guild) {
  const categories = await ensureTicketCategories(guild);
  const logChannel = await findUtilityChannel(guild, LOG_CHANNEL_NAME);
  const transcriptChannel = await findUtilityChannel(guild, TRANSCRIPT_CHANNEL_NAME);
  return { categories, logChannel, transcriptChannel };
}

function cleanChannelPart(value, fallback = 'ticket') {
  return String(value || fallback)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || fallback;
}

function ticketName(user, code, ticket, answers = {}) {
  if (ticket?.label === 'Buying/Selling Spawners') {
    const spawnerType = cleanChannelPart(answers.spawner_type || answers['what_type_of_spawner'] || 'spawner');
    const amount = cleanChannelPart(answers.amount || 'amount');
    const buySell = cleanChannelPart(answers.buy_or_sell || answers['buy_sell'] || 'trade');
    return `${spawnerType}-${amount}-${buySell}-${code}`.slice(0, 100);
  }
  if (ticket?.label === 'Claim Giveaway') {
    const host = cleanChannelPart(answers.hosted_by || 'giveaway');
    const amount = cleanChannelPart(answers.win_amount || 'amount');
    return `giveaway-${host}-${amount}-${code}`.slice(0, 100);
  }
  if (ticket?.label === 'Partner') {
    const memberCount = cleanChannelPart(answers.server_member_count || 'members');
    return `partner-${memberCount}-${code}`.slice(0, 100);
  }
  if (ticket?.label === 'Building services') return `building-${code}`;
  if (ticket?.label === 'Digging services') return `digging-${code}`;
  if (ticket?.label === 'Support') return `support-${code}`;
  if (ticket?.label === 'Middleman service') return `mm-${code}`;
  if (ticket?.label === 'Sponsor a giveaway') {
    const amount = cleanChannelPart(answers.sponsor_amount || 'amount');
    return `sponsor-${amount}-${code}`.slice(0, 100);
  }
  const cleanUser = cleanChannelPart(user.username, 'user').slice(0, 18);
  return `ticket-${cleanUser}-${code}`;
}

export async function findExistingTicket(guild, userId, categoryName) {
  try { await guild.channels.fetch(); } catch {}
  return guild.channels.cache.find((channel) => {
    const ticket = getTicketFromChannel(channel);
    return channel.type === ChannelType.GuildText && ticket?.openerId === userId && ticket?.categoryName?.toLowerCase() === categoryName.toLowerCase();
  }) || null;
}

function buildWelcomeText(guild, template, user, fallback) {
  let text = String(template || fallback).replaceAll('{user}', `<@${user.id}>`);
  const guildRoles = [...guild.roles.cache.values()].sort((a, b) => b.name.length - a.name.length);
  for (const role of guildRoles) text = text.replaceAll(`@${role.name}`, `<@&${role.id}>`);
  return text;
}

export async function createTicketChannel({ guild, user, typeId, answers = {} }) {
  const ticket = TICKET_TYPES[typeId];
  if (!ticket) throw new Error('Unknown ticket type.');
  const existing = await findExistingTicket(guild, user.id, ticket.categoryName);
  if (existing) return { existing };
  const category = categoryByName(guild, ticket.categoryName) || (await ensureTicketCategories(guild))[ticket.categoryName];
  if (!category) throw new Error(`Could not create or find ticket category \"${ticket.categoryName}\".`);

  const pingRoles = resolveRoles(guild, ticket.pingRoles);
  const accessRoles = resolveRoles(guild, ticket.accessRoles || []);
  const supportRoles = [...new Map([...pingRoles, ...accessRoles].map((role) => [role.id, role])).values()];

  let code; let name;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
    name = ticketName(user, code, ticket, answers);
  } while (guild.channels.cache.some((channel) => channel.name === name));

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
    ...supportRoles.map((role) => ({
      id: role.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.UseApplicationCommands],
    })),
  ];
  if (guild.members.me) overwrites.push({
    id: guild.members.me.id,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.UseApplicationCommands],
  });

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `This is the start of the #${name} private channel.`,
    permissionOverwrites: overwrites,
    reason: `TigerBot ticket opened by ${user.tag} (${ticket.label})`,
  });

  const mentions = pingRoles.map((role) => `<@&${role.id}>`).join(' ');
  const displayName = user.displayName || user.username;
  let welcomeText = buildWelcomeText(guild, ticket.welcomeMessage, user, `${displayName} Welcome! ${mentions || 'Staff'} will get to you shortly.`);
  // Always include the ticket creator's mention and explicitly allow that user mention.
  // This prevents Discord's allowed-mentions settings from silently suppressing the creator ping.
  if (!welcomeText.includes(`<@${user.id}>`)) welcomeText = `<@${user.id}> ${welcomeText}`;
  const answerFields = Object.keys(answers).length && ticket.form?.length
    ? ticket.form
        .filter((field) => answers[field.id] !== undefined && answers[field.id] !== '—')
        .map((field) => ({ name: field.label, value: String(answers[field.id] ?? '—').slice(0, 1024) }))
    : [];

  const ticketEmbed = new EmbedBuilder().setTitle(ticket.label).addFields({ name: 'Ticket Code', value: `\`${code}\``, inline: true }, ...answerFields).setFooter({ text: 'Tiger Market • Ticket Support' });
  const ticketActionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('calculate_ticket').setLabel('Calculate').setEmoji('🧮').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_add_user').setLabel('Add User').setEmoji('👤').setStyle(ButtonStyle.Secondary),
  );
  const welcomeRoleIds = [...welcomeText.matchAll(/<@&(\d+)>/g)].map((match) => match[1]);
  const allowedRoleIds = [...new Set([...pingRoles.map((role) => role.id), ...welcomeRoleIds])];
  await channel.send({
    content: welcomeText,
    allowedMentions: { users: [user.id], roles: allowedRoleIds },
  });
  await channel.send({ embeds: [ticketEmbed], components: [ticketActionRow] });

  return { channel, metadata: { typeId, openerId: user.id, categoryName: ticket.categoryName, code } };
}

export async function requestClose(channel, member) {
  const ticket = getTicketFromChannel(channel);
  if (!ticket) throw new Error('This channel is not a managed ticket.');
  const definition = ticket.typeId ? TICKET_TYPES[ticket.typeId] : null;
  const staffDefinition = definition || { pingRoles: [], accessRoles: [] };
  if (!isStaffForTicket(member, staffDefinition)) throw new Error('Only the ticket staff team can request a close.');
  const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
  if (recent?.some((message) => message.embeds?.some((embed) => embed.title === 'Close Request'))) return null;

  const ownerMention = `<@${ticket.openerId}>`;
  const embed = new EmbedBuilder().setTitle('Close Request').setDescription(`Staff member ${member} has requested to close this ticket.\n\nTicket owner: ${ownerMention}\n\n**Confirmation**\n> Would you like to close this ticket?`);
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Confirm').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary));
  return channel.send({ content: ownerMention, embeds: [embed], components: [row] });
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

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function buildTranscriptHtml(channel, actor, messages) {
  const actorName = actor?.displayName || actor?.user?.displayName || actor?.user?.username || 'Unknown';
  const body = messages.map((message) => {
    const attachments = [...message.attachments.values()].map((attachment) => `<p>📎 <a href=\"${escapeHtml(attachment.url)}\">${escapeHtml(attachment.name || attachment.url)}</a></p>`).join('');
    const embeds = message.embeds?.length ? `<p><i>[${message.embeds.length} embed(s)]</i></p>` : '';
    return `<article><b>${escapeHtml(message.author.displayName || message.author.username)}</b> <small>${escapeHtml(message.createdAt.toISOString())}</small><pre>${escapeHtml(message.content || '')}</pre>${attachments}${embeds}</article>`;
  }).join('');
  return `<!doctype html><html><head><meta charset=\"utf-8\"><title>${escapeHtml(channel.name)}</title><style>body{font-family:Arial,sans-serif;background:#111;color:#eee;padding:24px;max-width:1100px;margin:auto}article{padding:12px 0;border-bottom:1px solid #333}small{color:#aaa}pre{white-space:pre-wrap;font:inherit;margin:6px 0}a{color:#7dd3fc}</style></head><body><h1>${escapeHtml(channel.name)}</h1><p>Closed by ${escapeHtml(actorName)} • ${escapeHtml(new Date().toISOString())}</p>${body}</body></html>`;
}

export async function closeTicket(channel, actor) {
  const ticket = getTicketFromChannel(channel);
  if (!ticket) throw new Error('This channel is not a managed ticket.');
  const transcriptChannel = await findUtilityChannel(channel.guild, TRANSCRIPT_CHANNEL_NAME);
  if (!transcriptChannel) throw new Error(`The #${TRANSCRIPT_CHANNEL_NAME} channel was not found. Please create it first.`);

  const messages = await fetchAllMessages(channel);
  const html = buildTranscriptHtml(channel, actor, messages);
  const transcriptBuffer = Buffer.from(html, 'utf8');
  const transcriptFileName = `${channel.name}-transcript.html`;
  const actorName = actor?.displayName || actor?.user?.displayName || actor?.user?.username || 'Unknown';
  const ticketNumber = channel.name.match(/-(\d{4})$/)?.[1] || channel.id.slice(-4);
  const durationMinutes = Math.max(0, Math.floor((Date.now() - channel.createdTimestamp) / 60000));
  const creatorId = ticket.openerId;
  const subject = TICKET_TYPES[ticket.typeId]?.label || ticket.categoryName || 'Support Ticket';

  // Keep every previous transcript message in the transcripts channel.
  // Each closed ticket gets its own persistent transcript entry, so closing
  // a new ticket never deletes or replaces transcripts from older tickets.

  // Store the transcript behind a button instead of uploading it into the
  // transcripts channel. This keeps the channel message identical to the DM.
  const transcriptToken = `transcript:${channel.id}:${Date.now()}`;
  storeTranscript(transcriptToken, transcriptBuffer, transcriptFileName);

  const closedAt = Math.floor(Date.now() / 1000);
  // Keep the original transcript panel exactly as it was, with the full
  // ticket ID added as one extra field.
  const transcriptEmbed = new EmbedBuilder()
    .setTitle('Auto-Generated Transcript')
    .setDescription(`Transcript automatically generated for ticket #${ticketNumber}`)
    .addFields(
      {
        name: 'Ticket',
        value: [
          `> Ticket #${ticketNumber}`,
          `> Created by <@${creatorId}>`,
          `> ${messages.length} message${messages.length === 1 ? '' : 's'}`,
        ].join('\\n'),
      },
      {
        name: 'Generation',
        value: [
          `> Duration: ${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}`,
          '> Status: Closed (Auto-transcript)',
        ].join('\\n'),
      },
      {
        name: 'Subject',
        value: `> ${subject.slice(0, 1024)}`,
      },
      {
        name: 'ID',
        value: `> ${channel.id}`,
      },
    )
    .setFooter({ text: `Powered by TicketCord.com • <t:${closedAt}:f>` });
  const downloadRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
       .setCustomId('download_transcript')
      .setLabel('Download Transcript')
      .setEmoji('📄')
      .setStyle(ButtonStyle.Secondary),
  );

  // Send exactly one message: the same clean panel and download button used in DMs.
  const transcriptPanelMessage = await transcriptChannel.send({
    embeds: [transcriptEmbed],
    components: [downloadRow],
  });
  bindTranscriptMessage(transcriptPanelMessage.id, transcriptToken);

  try {
    const owner = await channel.guild.members.fetch(ticket.openerId);
    // DM panel uses the exact compact closed-ticket format requested.
    const dmEmbed = new EmbedBuilder()
      .setTitle('Ticket Closed')
      .setDescription([
        'Your ticket in **Tiger Market** has been closed.',
        '',
        `**Ticket ID:** ${channel.id}`,
        `-# <t:${closedAt}:f>`,
      ].join('\\n'))
      .setFooter({ text: 'Tiger Market • Ticket Support' });

    const dmMessage = await owner.send({
      embeds: [dmEmbed],
      components: [downloadRow],
    });
    bindTranscriptMessage(dmMessage.id, transcriptToken);

  } catch (dmError) {
    // Do not let a failed DM prevent the ticket from being closed.
    console.warn(`Could not DM transcript to ticket creator ${ticket.openerId}: ${dmError.message}`);
  }
  await channel.delete(`Ticket closed by ${actorName}`);
}


// Kept for compatibility with existing interaction handlers. Ticket logging is intentionally disabled.
export async function logTicket(_guild, _message) {
  return null;
}
