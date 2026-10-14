import { withUpdatePostLock } from './updatePostLock.js';
import { logger } from './logger.js';

const RECONCILE_DELAY_MS = 1300;

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

/**
 * Replace one logical bot-owned update post with exactly one current message.
 * It edits the newest existing matching message, removes older duplicates,
 * and performs a delayed second reconciliation to handle overlapping instances.
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
        // A stored message may already have been deleted.
      }
    }

    const scanHistory = async () => {
      try {
        const recent = await channel.messages.fetch({ limit: 100 });
        for (const message of recent.values()) addIfManaged(message);
      } catch (error) {
        logger.warn(`Could not scan recent messages for duplicate ${label} posts in channel ${channel.id}:`, error?.message || error);
      }
    };

    await scanHistory();
    let ordered = [...candidates.values()].sort(newestFirst);
    let canonical = ordered[0] || null;

    if (canonical) {
      canonical = await canonical.edit(payload);
    } else {
      canonical = await channel.send(payload);
    }

    // A second deployment may have posted at nearly the same time. Let that
    // request finish, then pick the newest message and remove the extra copies.
    await wait(RECONCILE_DELAY_MS);
    await scanHistory();

    addIfManaged(canonical, true);
    ordered = [...candidates.values()].sort(newestFirst);
    canonical = ordered[0] || canonical;

    // Make sure the retained message carries this update's intended contents.
    try {
      canonical = await canonical.edit(payload);
    } catch (error) {
      logger.warn(`Could not refresh canonical ${label} message ${canonical.id}:`, error?.message || error);
    }

    for (const duplicate of ordered) {
      if (duplicate.id === canonical.id) continue;
      try {
        await duplicate.delete();
      } catch (error) {
        logger.warn(`Could not delete duplicate ${label} message ${duplicate.id}:`, error?.message || error);
      }
    }

    await onSaved(canonical);
    return canonical;
  });
}

/**
 * Multi-message variant used by update posts that exceed Discord's 2,000
 * character limit. Part markers use invisible separators so each continuation
 * can be reconciled without confusing it with another bot message.
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

  const taggedContents = contents.map((part, index) =>
    `${part}\u2063tigerbot_update_part_${index + 1}\u2063`
  );

  return withUpdatePostLock(channel.id, async () => {
    const candidates = taggedContents.map(() => new Map());
    const addCandidate = (message, hintedIndex = null) => {
      if (!message || message.author?.id !== client.user.id) return;
      let index = hintedIndex;
      if (index === null) {
        index = matchesPart(message, taggedContents);
      }
      if (Number.isInteger(index) && index >= 0 && index < candidates.length) {
        candidates[index].set(message.id, message);
      }
    };

    // Saved IDs keep backward compatibility with prior versions that did not
    // have invisible part markers.
    for (let index = 0; index < previousMessageIds.length; index += 1) {
      const id = previousMessageIds[index];
      if (!id) continue;
      try {
        addCandidate(await channel.messages.fetch(id), index);
      } catch {}
    }

    const scanHistory = async () => {
      try {
        const recent = await channel.messages.fetch({ limit: 100 });
        for (const message of recent.values()) addCandidate(message);
      } catch (error) {
        logger.warn(`Could not scan recent messages for duplicate ${label} parts in channel ${channel.id}:`, error?.message || error);
      }
    };

    const sorted = (index) => [...candidates[index].values()].sort(newestFirst);
    await scanHistory();

    const active = [];
    for (let index = 0; index < taggedContents.length; index += 1) {
      const existing = sorted(index)[0];
      active[index] = existing
        ? await existing.edit({ content: taggedContents[index] })
        : await channel.send({ content: taggedContents[index] });
    }

    await wait(RECONCILE_DELAY_MS);
    await scanHistory();
    for (let index = 0; index < active.length; index += 1) {
      addCandidate(active[index], index);
    }

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

      for (const duplicate of existing.slice(1)) {
        try {
          await duplicate.delete();
        } catch (error) {
          logger.warn(`Could not delete duplicate ${label} part ${duplicate.id}:`, error?.message || error);
        }
      }
    }

    await onSaved(canonical);
    return canonical;
  });
}
