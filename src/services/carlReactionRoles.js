import { ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { hasDangerousPermissions } from './reactionRoleService.js';
import { logger } from '../utils/logger.js';

// Carl-bot-style prefix setup is intentionally separate from the existing
// /reactroles dropdown panels. Both systems can run without overwriting each other.
const sessions = new Map();
const MAX_ROLES = 25;
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_COLOR = 0xffa500;

function panelKey(guildId, messageId) {
  return 'guild:' + guildId + ':carl_reaction_roles:' + messageId;
}


function unwrapPanel(value) {
  if (value && Array.isArray(value.entries)) return value;
  if (value?.value && Array.isArray(value.value.entries)) return value.value;
  return null;
}

function isCarlPanelMessage(message, client) {
  return message?.author?.id === client.user?.id
    && message.embeds?.[0]?.footer?.text ===
      'React to add a role; remove your reaction to remove the role.';
}

/** Rebuild mappings from a previously posted panel if the database record is missing.
 * Only bot-authored messages carrying our exact footer are trusted.
 */
export async function recoverCarlPanel(message, client) {
  if (!isCarlPanelMessage(message, client)) return null;
  const guild = message.guild;
  if (!guild) return null;
  const description = message.embeds[0].description || '';
  const entries = [];
  const seenEmoji = new Set();
  for (const line of description.split(/\r?\n/)) {
    const match = line.trim().match(/^(\S+)\s+<@&(\d{17,20})>$/u);
    if (!match) continue;
    const [, emoji, roleId] = match;
    const role = guild.roles.cache.get(roleId)
      || await guild.roles.fetch(roleId).catch(() => null);
    if (!role) continue;
    const emojiKey = normalizeCarlEmoji(emoji);
    if (seenEmoji.has(emojiKey)) continue;
    seenEmoji.add(emojiKey);
    entries.push({ emoji, emojiKey, roleId, roleName: role.name });
  }
  if (entries.length === 0 || entries.length > MAX_ROLES) return null;
  const data = {
    guildId: guild.id,
    channelId: message.channelId,
    messageId: message.id,
    entries,
    recoveredAt: new Date().toISOString(),
  };
  const saved = await client.db.set(panelKey(guild.id, message.id), data);
  if (saved === false) logger.warn('Reaction role panel recovered but DB save returned false for ' + message.id);
  logger.info('Recovered Carl-style reaction-role panel ' + message.id + ' (' + entries.length + ' roles)');
  return data;
}

async function loadCarlPanel(message, client) {
  const guildId = message.guildId || message.guild?.id;
  if (!guildId) return null;
  const stored = unwrapPanel(await client.db.get(panelKey(guildId, message.id)));
  if (stored) return stored;
  // Discord retains the published embed, including all emoji-to-role mappings.
  return recoverCarlPanel(message, client);
}

function checkCommandTarget(raw, guildId) {
  const input = String(raw || '').trim();
  const link = input.match(/(?:https?:\/\/)?(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/(\d{17,20})\/(\d{17,20})\/(\d{17,20})/i);
  if (link) return link[1] === guildId ? { channelId: link[2], messageId: link[3] } : null;
  if (/^\d{17,20}$/.test(input)) return { channelId: null, messageId: input };
  return null;
}

/** Admin diagnostics and recovery for an existing posted reaction-role panel. */
async function checkPanel(message, client, raw) {
  const target = checkCommandTarget(raw, message.guild.id);
  if (!target) {
    await say(message, 'Send a message link from this server: !rr check https://discord.com/channels/SERVER_ID/CHANNEL_ID/MESSAGE_ID');
    return;
  }
  let data = unwrapPanel(await client.db.get(panelKey(message.guild.id, target.messageId)));
  const channelId = target.channelId || data?.channelId;
  if (!channelId) {
    await say(message, 'I have no saved record for that ID. Use the FULL Discord message link so I can recover the original panel.');
    return;
  }
  const channel = message.guild.channels.cache.get(channelId)
    || await message.guild.channels.fetch(channelId).catch(() => null);
  const panel = await channel?.messages?.fetch(target.messageId).catch(() => null);
  if (!panel) {
    await say(message, 'I cannot read that reaction-role message. Check its link and View Channel / Read Message History permissions.');
    return;
  }
  if (!data) data = await recoverCarlPanel(panel, client);
  if (!data) {
    await say(message, 'This is not a recognized TigerBot emoji reaction-role panel. No changes were made.');
    return;
  }
  const me = await message.guild.members.fetchMe().catch(() => null);
  const missing = [];
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) missing.push('Manage Roles permission');
  if (!me || !channel.permissionsFor(me)?.has(PermissionFlagsBits.ViewChannel)) missing.push('View Channel permission');
  if (!me || !channel.permissionsFor(me)?.has(PermissionFlagsBits.ReadMessageHistory)) missing.push('Read Message History permission');
  if (!me || !channel.permissionsFor(me)?.has(PermissionFlagsBits.AddReactions)) missing.push('Add Reactions permission');

  const invalidRoles = [];
  for (const entry of data.entries) {
    const role = message.guild.roles.cache.get(entry.roleId)
      || await message.guild.roles.fetch(entry.roleId).catch(() => null);
    const problem = me ? roleError(role, message.guild, me) : 'Cannot fetch bot member';
    if (problem) invalidRoles.push(entry.roleName + ': ' + problem);
  }
  const addListeners = client.listenerCount('messageReactionAdd');
  const removeListeners = client.listenerCount('messageReactionRemove');
  const result = [
    'Reaction-role panel diagnostics:',
    'Panel: ' + panel.url,
    'Roles mapped: ' + data.entries.length,
    'Reaction handlers: add=' + addListeners + ', remove=' + removeListeners,
    'Missing permissions: ' + (missing.join(', ') || 'none'),
    'Role problems: ' + (invalidRoles.join('; ') || 'none'),
    !missing.length && !invalidRoles.length && addListeners && removeListeners
      ? '✅ All checks passed. Try reacting again. If it still fails, inspect the host logs for "Carl-style reaction role".'
      : '⚠️ Fix the issues above, restart the bot if reaction handlers are missing, and try again.',
  ];
  await say(message, result.join('\n').slice(0, 1950));
}

function sessionKey(message) {
  return message.guild.id + ':' + message.channelId + ':' + message.author.id;
}

function isAdmin(message) {
  return Boolean(message.member?.permissions?.has(PermissionFlagsBits.Administrator));
}

async function say(message, content) {
  return message.channel.send({ content, allowedMentions: { parse: [] } });
}

function finishSession(key) {
  sessions.delete(key);
}

function startSession(key) {
  const session = {
    step: 'channel',
    channel: null,
    color: DEFAULT_COLOR,
    title: '',
    description: '',
    entries: [],
    expiresAt: Date.now() + SESSION_TIMEOUT_MS,
  };
  sessions.set(key, session);
  const timeout = setTimeout(() => {
    if (sessions.get(key) === session) sessions.delete(key);
  }, SESSION_TIMEOUT_MS);
  timeout.unref?.();
  return session;
}

function findChannel(guild, value) {
  const raw = String(value || '').trim();
  const mention = raw.match(/^<#(\d{17,20})>$/);
  const id = mention?.[1] || (/^\d{17,20}$/.test(raw) ? raw : null);
  if (id) return guild.channels.cache.get(id) || null;
  const name = raw.replace(/^#/, '').toLowerCase();
  return guild.channels.cache.find(channel => channel.name?.toLowerCase() === name) || null;
}

export function normalizeCarlEmoji(emoji) {
  const raw = String(emoji || '').trim();
  const custom = raw.match(/^<a?:[A-Za-z0-9_]+:(\d{17,20})>$/);
  return custom ? custom[1] : raw;
}

export function parseCarlRoleLine(line) {
  const match = String(line || '').trim().match(/^(\S+)\s+(.+)$/u);
  if (!match) return null;
  return { emoji: match[1], roleInput: match[2].trim() };
}

function resolveRole(guild, roleInput) {
  const text = roleInput.trim();
  const mention = text.match(/^<@&(\d{17,20})>$/);
  const id = mention?.[1] || (/^\d{17,20}$/.test(text) ? text : null);
  if (id) return guild.roles.cache.get(id) || null;
  const name = text.replace(/^@/, '').toLowerCase();
  return guild.roles.cache.find(role => role.name.toLowerCase() === name) || null;
}

function roleError(role, guild, botMember) {
  if (!role) return 'Role not found. Use an exact role name or @role mention.';
  if (role.id === guild.id || role.managed) return 'The @everyone and integration roles are not assignable.';
  if (hasDangerousPermissions(role) || role.permissions.has(PermissionFlagsBits.MentionEveryone)) {
    return 'That role has protected permissions and cannot be self-assigned.';
  }
  if (role.position >= botMember.roles.highest.position) {
    return 'Move TigerBot above this role in Server Settings > Roles first.';
  }
  return null;
}

function describeSteps() {
  return 'Send the channel mention or name where the final reaction-role message should be posted (example: #reaction-roles). Type cancel to stop.';
}

async function publish(message, client, key, session) {
  if (session.entries.length === 0) {
    await say(message, 'Add at least one emoji and role before sending done.');
    return;
  }

  const guild = message.guild;
  const channel = session.channel;
  const me = await guild.members.fetchMe().catch(() => null);
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await say(message, 'TigerBot needs Manage Roles to assign roles. Fix its permissions and send done again.');
    return;
  }
  const required = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AddReactions,
  ];
  if (!channel.permissionsFor(me)?.has(required)) {
    await say(message, 'TigerBot needs View Channel, Send Messages, Read Message History, Embed Links, and Add Reactions in the chosen channel. Fix permissions and send done again.');
    return;
  }

  for (const entry of session.entries) {
    const role = guild.roles.cache.get(entry.roleId);
    const error = roleError(role, guild, me);
    if (error) {
      await say(message, 'Cannot post: ' + entry.roleName + ': ' + error);
      return;
    }
  }

  const lines = session.entries.map(entry => entry.emoji + ' <@&' + entry.roleId + '>');
  const embed = new EmbedBuilder()
    .setTitle(session.title)
    .setDescription(session.description + '\n\n' + lines.join('\n'))
    .setColor(session.color)
    .setFooter({ text: 'React to add a role; remove your reaction to remove the role.' });

  let posted;
  try {
    posted = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    // Add real emoji reactions to ONE message, as Carl-bot does.
    for (const entry of session.entries) {
      await posted.react(entry.emoji);
    }
    const saved = await client.db.set(panelKey(guild.id, posted.id), {
      guildId: guild.id,
      channelId: channel.id,
      messageId: posted.id,
      entries: session.entries.map(entry => ({ ...entry })),
      createdAt: new Date().toISOString(),
    });
    if (saved === false) throw new Error('Reaction-role data could not be saved to database');
  } catch (error) {
    if (posted) await posted.delete().catch(() => {});
    logger.error('Carl-style reaction roles could not be published:', error);
    await say(message, 'Could not publish the panel. Make sure every emoji works in this server and the bot has the required permissions. Your setup is saved here. Fix permissions and send done again, or send cancel to restart if an emoji is invalid.');
    return;
  }

  finishSession(key);
  await say(message, '✅ One reaction-role panel with ' + session.entries.length + ' roles is ready: ' + posted.url);
}

async function removePanel(message, client, messageId) {
  const data = unwrapPanel(await client.db.get(panelKey(message.guild.id, messageId)));
  if (!data) {
    await say(message, 'No TigerBot emoji-reaction panel was found with that message ID.');
    return;
  }
  const channel = message.guild.channels.cache.get(data.channelId)
    || await message.guild.channels.fetch(data.channelId).catch(() => null);
  const posted = await channel?.messages?.fetch(messageId).catch(() => null);
  if (posted) {
    try {
      await posted.delete();
    } catch {
      await say(message, 'I cannot delete that message. Check Manage Messages / channel permissions and retry.');
      return;
    }
  }
  await client.db.delete(panelKey(message.guild.id, messageId));
  await say(message, '✅ Reaction-role panel deleted.');
}

/**
 * Called BEFORE regular prefix-command handling and channel auto-moderation.
 * Returns true when the message belongs to this interactive wizard.
 */
export async function handleCarlReactionRoleMessage(message, client) {
  if (!message.guild || message.author.bot) return false;
  const content = String(message.content || '').trim();
  const key = sessionKey(message);
  const starts = /^!rr\s+make$/i.test(content);
  const deletion = content.match(/^!rr\s+delete\s+(\d{17,20})$/i);
  const diagnostic = content.match(/^!rr\s+check\s+(.+)$/i);
  let session = sessions.get(key);

  if (!session && !starts && !deletion && !diagnostic) return false;
  if (!isAdmin(message)) {
    if (starts || deletion || diagnostic) await say(message, 'Only server administrators can manage reaction-role panels.');
    return Boolean(starts || deletion || diagnostic);
  }

  if (deletion) {
    await removePanel(message, client, deletion[1]);
    return true;
  }
  if (diagnostic) {
    await checkPanel(message, client, diagnostic[1]);
    return true;
  }
  if (starts) {
    startSession(key);
    await say(message, '🎭 Reaction-role setup started!\n' + describeSteps());
    return true;
  }
  if (Date.now() > session.expiresAt) {
    finishSession(key);
    await say(message, 'Your setup expired after 15 minutes. Send !rr make to restart.');
    return true;
  }
  if (/^cancel$/i.test(content)) {
    finishSession(key);
    await say(message, 'Reaction-role setup canceled. No panel was posted.');
    return true;
  }

  if (session.step === 'channel') {
    const channel = findChannel(message.guild, content);
    if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
      await say(message, 'I could not find that text channel. ' + describeSteps());
      return true;
    }
    session.channel = channel;
    session.step = 'color';
    await say(message, 'Send an embed color like #FFA500, or send skip for orange.');
    return true;
  }

  if (session.step === 'color') {
    if (/^skip$/i.test(content)) {
      session.color = DEFAULT_COLOR;
    } else if (/^#?[0-9a-f]{6}$/i.test(content)) {
      session.color = parseInt(content.replace('#', ''), 16);
    } else {
      await say(message, 'Send a six-digit hex color, for example #FFA500, or skip.');
      return true;
    }
    session.step = 'details';
    await say(message, 'Send the panel title and description in ONE message, separated by | . Example:\nTiger Market | Ping Roles | React below to choose your notifications!');
    return true;
  }

  if (session.step === 'details') {
    const index = content.lastIndexOf(' | ');
    if (index < 1) {
      await say(message, 'Use this format with a space on each side of the vertical line:\nTiger Market | Ping Roles | React below to choose your notifications!');
      return true;
    }
    const title = content.slice(0, index).trim();
    const description = content.slice(index + 3).trim();
    if (!title || !description || title.length > 256 || description.length > 2500) {
      await say(message, 'Title must be 1-256 characters; description must be 1-2500 characters.');
      return true;
    }
    session.title = title;
    session.description = description;
    session.step = 'roles';
    await say(message,
      'Now send emoji and role pairs. You can paste ALL roles in ONE message, one per line, like:\n🎉 Giveaway Ping\n📢 Announcement Ping\n\nUse exact server role names (or @role mentions). Send done afterward, or put done on the last line to post immediately. Maximum 25 roles.');
    return true;
  }

  if (session.step === 'roles') {
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const end = lines.at(-1)?.toLowerCase() === 'done';
    const pairLines = end ? lines.slice(0, -1) : lines;

    const me = await message.guild.members.fetchMe().catch(() => null);
    if (!me) {
      await say(message, 'TigerBot cannot check its role position. Please retry.');
      return true;
    }
    const added = [];
    const seenEmojis = new Set(session.entries.map(entry => entry.emojiKey));
    const seenRoles = new Set(session.entries.map(entry => entry.roleId));
    const errors = [];

    for (const line of pairLines) {
      const pair = parseCarlRoleLine(line);
      if (!pair) {
        errors.push('Invalid line: ' + line);
        continue;
      }
      const role = resolveRole(message.guild, pair.roleInput);
      const roleIssue = roleError(role, message.guild, me);
      const emojiKey = normalizeCarlEmoji(pair.emoji);
      if (roleIssue) errors.push(pair.roleInput + ': ' + roleIssue);
      else if (!emojiKey || seenEmojis.has(emojiKey)) errors.push('Duplicate or invalid emoji: ' + pair.emoji);
      else if (seenRoles.has(role.id)) errors.push('Role added twice: ' + role.name);
      else if (session.entries.length + added.length >= MAX_ROLES) errors.push('This panel can have at most 25 roles.');
      else {
        added.push({ emoji: pair.emoji, emojiKey, roleId: role.id, roleName: role.name });
        seenEmojis.add(emojiKey);
        seenRoles.add(role.id);
      }
    }

    if (errors.length) {
      await say(message, 'Please correct these entries and resend your message (nothing from this message was saved):\n' + errors.slice(0, 8).join('\n').slice(0, 1600));
      return true;
    }

    session.entries.push(...added);
    if (end) {
      await publish(message, client, key, session);
    } else {
      await say(message, '✅ Added ' + added.length + ' role(s). Total: ' + session.entries.length + '/25. Send more emoji-role pairs, or send done to post ONE panel.');
    }
    return true;
  }

  return true;
}

/** Handle reaction added/removed on Carl-style panels only. */
export async function handleCarlReactionChange(reaction, user, client, adding) {
  if (!user || user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message?.partial) await reaction.message.fetch();
    const message = reaction.message;
    const guildId = message.guildId || message.guild?.id;
    if (!guildId) return;

    const data = await loadCarlPanel(message, client);
    if (!data?.entries?.length) {
      logger.warn('No saved reaction-role mapping or recoverable panel for message ' + message.id);
      return;
    }
    const emojiKey = reaction.emoji.id || reaction.emoji.name;
    const entry = data.entries.find(item => item.emojiKey === emojiKey);
    if (!entry) {
      logger.warn('Reaction emoji ' + emojiKey + ' is not mapped for panel ' + message.id);
      return;
    }

    const guild = message.guild || await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(user.id).catch(() => null);
    const me = await guild.members.fetchMe().catch(() => null);
    const role = guild.roles.cache.get(entry.roleId)
      || await guild.roles.fetch(entry.roleId).catch(() => null);
    const issue = !me ? 'Bot membership unavailable' : roleError(role, guild, me);
    if (!member || issue || !me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      logger.warn('Reaction role assignment skipped for message ' + message.id + ': ' +
        (!member ? 'Member not found' : issue || 'Missing Manage Roles permission'));
      return;
    }

    if (!adding) {
      if (member.roles.cache.has(role.id)) await member.roles.remove(role);
      logger.info('Reaction role removal processed: ' + entry.roleName + ' for ' + user.id);
      return;
    }

    const noPings = data.entries.find(item => /^no\s+pings?$/i.test(item.roleName.trim()));
    if (noPings) {
      const conflicting = entry.roleId === noPings.roleId
        ? data.entries.filter(item => item.roleId !== noPings.roleId)
        : [noPings];
      for (const other of conflicting) {
        const otherRole = guild.roles.cache.get(other.roleId);
        if (otherRole && member.roles.cache.has(otherRole.id)) {
          await member.roles.remove(otherRole);
        }
        // Remove contradictory reaction marks when Manage Messages is available.
        const existingReaction = message.reactions.cache.find(item =>
          (item.emoji.id || item.emoji.name) === other.emojiKey);
        if (existingReaction) {
          await existingReaction.users.remove(user.id).catch(() => {});
        }
      }
    }

    if (!member.roles.cache.has(role.id)) await member.roles.add(role);
    logger.info('Reaction role assignment processed: ' + entry.roleName + ' for ' + user.id);
  } catch (error) {
    logger.error('Carl-style reaction role update failed:', error);
  }
}