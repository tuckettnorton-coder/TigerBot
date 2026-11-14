import { logger } from '../utils/logger.js';

// These roles are completely exempt from the edited-link filter.
export const NO_EDIT_EXEMPT_ROLE_IDS = new Set([
  '1536862219407597660',
  '1526333765633441943',
  '1517215676631089294',
  '1476355316877758627',
]);

export const noEditSettingKey = (guildId) => 'guild:' + guildId + ':noedit';

// Catch regular URLs, invite links, markdown URLs and clickable bare domains.
// This only inspects the edited message text; it does not scan attachments.
const LINK_PATTERNS = [
  /(?:https?|ftp|ftps):\/\/[^\s<>()]+/i,
  /(?:^|[\s(<])www\.[^\s<>()]+/i,
  /(?:^|[\s(<])discord\.(?:gg|com\/invite)\/[^\s<>()]+/i,
  /(?:^|[\s(<])(?:[a-z0-9-]+\.)+[a-z]{2,63}(?::\d+)?(?:[/?#][^\s<>()]*)?/i,
  /(?:^|[\s(<])(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:[/?#][^\s<>()]*)?/i,
  /\[[^\]]*\]\(\s*(?:https?|ftp|ftps):\/\/[^)]+\)/i,
];

export function findEditedLink(content) {
  const text = String(content || '');
  for (const pattern of LINK_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

// Default to ON for every server, including when storage is temporarily down.
export async function isNoEditEnabled(client, guildId) {
  if (!client?.db?.get) return true;
  try {
    const setting = await client.db.get(noEditSettingKey(guildId), { enabled: true });
    return setting?.enabled !== false;
  } catch (error) {
    logger.warn('No Edit: could not read the setting for guild ' + guildId + '; keeping protection enabled.', error);
    return true;
  }
}

export async function setNoEditEnabled(client, guildId, enabled, userId) {
  if (!client?.db?.set) throw new Error('Database is not available.');
  await client.db.set(noEditSettingKey(guildId), {
    enabled: Boolean(enabled),
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  });
}

export async function enforceNoEditOnUpdate(oldMessage, newMessage) {
  const guild = newMessage?.guild;
  const client = newMessage?.client;
  if (!guild || !client || newMessage.author?.bot || oldMessage?.author?.bot || newMessage.webhookId) {
    return false;
  }

  // Ignore embed-preview refreshes, other non-content updates, and initial posts.
  if (typeof newMessage.content !== 'string') return false;
  if (typeof oldMessage?.content === 'string' && oldMessage.content === newMessage.content) return false;
  if (typeof oldMessage?.content !== 'string' && !newMessage.editedTimestamp) return false;
  if (!findEditedLink(newMessage.content)) return false;
  if (!(await isNoEditEnabled(client, guild.id))) return false;

  const authorId = newMessage.author?.id || oldMessage?.author?.id;
  if (!authorId) return false;

  // An exempt role must never be accidentally moderated due to missing member data.
  let member = newMessage.member?.roles?.cache?.has ? newMessage.member : null;
  if (!member) member = oldMessage?.member?.roles?.cache?.has ? oldMessage.member : null;
  if (!member) {
    try {
      member = await guild.members.fetch(authorId);
    } catch (error) {
      logger.warn('No Edit: cannot verify roles for user ' + authorId + '; skipping deletion.', error);
      return false;
    }
  }
  if (!member?.roles?.cache?.has) {
    logger.warn('No Edit: member roles unavailable for user ' + authorId + '; skipping deletion.');
    return false;
  }
  if ([...NO_EDIT_EXEMPT_ROLE_IDS].some((roleId) => member.roles.cache.has(roleId))) {
    return false;
  }

  // Flag the deletion before deleting it, so the normal deletion log does not
  // reproduce a potentially malicious edited URL inside a different channel.
  if (!client.noEditRecentlyDeleted) client.noEditRecentlyDeleted = new Set();
  client.noEditRecentlyDeleted.add(newMessage.id);
  try {
    await newMessage.delete();
    const cleanup = setTimeout(() => client.noEditRecentlyDeleted?.delete(newMessage.id), 60_000);
    cleanup.unref?.();
    logger.info('No Edit removed a link-containing edited message ' + newMessage.id +
      ' in guild ' + guild.id + ', channel ' + newMessage.channelId + ', author ' + authorId);
    return true;
  } catch (error) {
    client.noEditRecentlyDeleted.delete(newMessage.id);
    logger.warn('No Edit could not delete edited message ' + newMessage.id +
      '. Check Manage Messages and channel access.', error);
    return false;
  }
}
