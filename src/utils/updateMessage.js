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
