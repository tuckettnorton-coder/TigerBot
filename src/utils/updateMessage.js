import { withUpdatePostLock } from './updatePostLock.js';
import { logger } from './logger.js';

const RECONCILE_DELAY_MS = 1300;

// Marker consists only of zero-width characters, so it is not visible in Discord.
export function getUpdateMessagePartMarker(index) {
  if (!Number.isInteger(index) || index < 0) throw new TypeError('Part index must be a non-negative integer.');
  return `\u2063${'\u200B'.repeat(index + 1)}\u2063`;
}

function newestFirst(a, b) {
  try {
    const left = BigInt(a.id);
    const right = BigInt(b.id);
    return right > left ? 1 : right < left ? -1 : 0;
  } catch {
    return (b.createdTimestamp || 0) - (a.createdTimestamp || 0);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryDelete(message, label) {
  try {
    await message.delete();
    return true;
  } catch (error) {
    logger.warn(`Could not delete old ${label} message ${message.id}; will try updating it in place instead:`, error?.message || error);
    return false;
  }
}

/**
 * Replace a logical bot-owned update post with one fresh message whenever the
 * old post can be deleted. If Discord refuses deletion, edit the existing post
 * instead of sending another copy or failing the update.
 */
export async function upsertUpdateMessage({
  client,
  channel,
  content,
  components,
  matches,
  previousMessageIds = [],
  onSaved = async () => {},
  label = 'update',
}) {
  if (!client?.user?.id) throw new Error('Bot client is not logged in.');
  if (!channel?.id || typeof channel.send !== 'function' || !channel.messages?.fetch) {
    throw new Error('The update destination is not a sendable text channel.');
  }
  if (typeof matches !== 'function') throw new TypeError('A message matcher is required.');

  const payload = { content };
  if (Array.isArray(components)) payload.components = components;

  return withUpdatePostLock(channel.id, async () => {
    const candidates = new Map();

    const addIfManaged = (message, savedId = false) => {
      if (!message || message.author?.id !== client.user.id) return;
      if (savedId || matches(message)) candidates.set(message.id, message);
    };

    for (const id of new Set((previousMessageIds || []).filter(Boolean))) {
      try {
        addIfManaged(await channel.messages.fetch(id), true);
      } catch {
        // A saved message may have been deleted or may be from a previous deployment.
      }
    }

    const scanHistory = async () => {
      try {
        const recent = await channel.messages.fetch({ limit: 100 });
        for (const message of recent.values()) addIfManaged(message);
        return true;
      } catch (error) {
        // History access is best-effort: a known saved message ID is still usable.
        logger.warn(`Could not scan recent messages for ${label} in channel ${channel.id}:`, error?.message || error);
        return false;
      }
    };

    await scanHistory();
    const ordered = [...candidates.values()].sort(newestFirst);
    let canonical = null;

    if (ordered.length) {
      const failedDeletes = [];
      for (const previous of ordered) {
        if (!await tryDelete(previous, label)) failedDeletes.push(previous);
      }

      if (failedDeletes.length) {
        // Keep and update one existing message if deletion is blocked. Do not
        // send a new one while an old copy is known to still exist.
        canonical = failedDeletes[0];
        canonical = await canonical.edit(payload);

        for (const leftover of ordered) {
          if (leftover.id === canonical.id || failedDeletes.includes(leftover)) continue;
          await tryDelete(leftover, label);
        }
      } else {
        canonical = await channel.send(payload);
      }
    } else {
      canonical = await channel.send(payload);
    }

    await wait(RECONCILE_DELAY_MS);
    candidates.clear();
    addIfManaged(canonical, true);
    await scanHistory();

    const reconciled = [...candidates.values()].sort(newestFirst);
    canonical = reconciled[0] || canonical;

    // If another request posted concurrently, retain the newest matching post.
    try {
      canonical = await canonical.edit(payload);
    } catch (error) {
      logger.warn(`Could not refresh canonical ${label} message ${canonical.id}:`, error?.message || error);
    }

    for (const duplicate of reconciled) {
      if (duplicate.id === canonical.id) continue;
      await tryDelete(duplicate, label);
    }

    await onSaved(canonical);
    return canonical;
  });
}

/**
 * Multi-message variant for posts exceeding Discord's character limit.
 * Existing parts are deleted and freshly posted where possible; if deletion is
 * blocked, that part is edited in place so the update still completes.
 */
export async function upsertUpdateMessageParts({
  client,
  channel,
  contents,
  matchesPart,
  previousMessageIds = [],
  onSaved = async () => {},
  label = 'update',
}) {
  if (!Array.isArray(contents) || contents.length === 0) {
    throw new Error('At least one message part is required.');
  }
  if (contents.some((part) => String(part).length > 1900)) {
    throw new Error('A message part is too long to post safely.');
  }
  if (typeof matchesPart !== 'function') throw new TypeError('A message-part matcher is required.');

  const taggedContents = contents.map((part, index) => `${part}${getUpdateMessagePartMarker(index)}`);

  return withUpdatePostLock(channel.id, async () => {
    const candidates = taggedContents.map(() => new Map());

    const addCandidate = (message, hintedIndex = null) => {
      if (!message || message.author?.id !== client.user.id) return;
      const index = hintedIndex === null ? matchesPart(message, taggedContents) : hintedIndex;
      if (Number.isInteger(index) && index >= 0 && index < candidates.length) {
        candidates[index].set(message.id, message);
      }
    };

    for (let index = 0; index < previousMessageIds.length; index += 1) {
      const id = previousMessageIds[index];
      if (!id) continue;
      try {
        addCandidate(await channel.messages.fetch(id), index);
      } catch {
        // A saved part may already have been deleted.
      }
    }

    const scanHistory = async () => {
      try {
        const recent = await channel.messages.fetch({ limit: 100 });
        for (const message of recent.values()) addCandidate(message);
        return true;
      } catch (error) {
        logger.warn(`Could not scan recent ${label} parts in channel ${channel.id}:`, error?.message || error);
        return false;
      }
    };

    await scanHistory();
    const sorted = (index) => [...candidates[index].values()].sort(newestFirst);
    const active = [];

    for (let index = 0; index < taggedContents.length; index += 1) {
      const existing = sorted(index);
      const failedDeletes = [];

      for (const previous of existing) {
        if (!await tryDelete(previous, `${label} part ${index + 1}`)) failedDeletes.push(previous);
      }

      if (failedDeletes.length) {
        active[index] = await failedDeletes[0].edit({ content: taggedContents[index] });
        for (const leftover of existing) {
          if (leftover.id === active[index].id || failedDeletes.includes(leftover)) continue;
          await tryDelete(leftover, `${label} part ${index + 1}`);
        }
      } else {
        active[index] = await channel.send({ content: taggedContents[index] });
      }
    }

    await wait(RECONCILE_DELAY_MS);
    for (const map of candidates) map.clear();
    for (let index = 0; index < active.length; index += 1) {
      addCandidate(active[index], index);
    }
    await scanHistory();

    const canonical = [];
    for (let index = 0; index < taggedContents.length; index += 1) {
      const existing = sorted(index);
      const keep = existing[0] || active[index];

      try {
        canonical[index] = await keep.edit({ content: taggedContents[index] });
      } catch (error) {
        logger.warn(`Could not refresh canonical ${label} part ${index + 1}:`, error?.message || error);
        canonical[index] = keep;
      }

      for (const duplicate of existing) {
        if (duplicate.id === canonical[index].id) continue;
        await tryDelete(duplicate, `${label} part ${index + 1}`);
      }
    }

    await onSaved(canonical);
    return canonical;
  });
}
