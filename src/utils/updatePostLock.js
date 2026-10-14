/**
 * Serializes update-panel posts per Discord channel.
 *
 * If two modal submissions arrive at nearly the same time, each updater runs
 * its delete/replace/send sequence only after the previous update in that
 * channel has finished. The next run can then read the latest saved message ID
 * instead of racing against the previous send.
 */
const channelLocks = new Map();

export async function withUpdatePostLock(channelId, operation) {
  if (!channelId) {
    throw new Error('A channel ID is required to serialize an update post.');
  }
  if (typeof operation !== 'function') {
    throw new TypeError('The update-post operation must be a function.');
  }

  const previous = channelLocks.get(channelId) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  channelLocks.set(channelId, current);

  try {
    return await current;
  } finally {
    if (channelLocks.get(channelId) === current) {
      channelLocks.delete(channelId);
    }
  }
}
