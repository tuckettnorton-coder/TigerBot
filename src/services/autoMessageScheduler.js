import { logger } from '../utils/logger.js';

// Prevent overlapping scheduler ticks from sending the same due message twice.
let schedulerRunning = false;

export async function processAutoMessages(client) {
  if (schedulerRunning || !client?.db || typeof client.db.list !== 'function') return;
  schedulerRunning = true;

  try {
    let keys;
    try {
      keys = await client.db.list('guild:');
    } catch (error) {
      logger.error('Could not list automatic message schedules:', error);
      return;
    }

    const now = Date.now();
    const processedKeys = new Set();
    for (const key of keys || []) {
      if (!String(key).endsWith(':auto-message') || processedKeys.has(String(key))) continue;
      processedKeys.add(String(key));

      try {
        const config = await client.db.get(key, null);
        if (!config?.enabled || !config.channelId || !config.message) continue;
        if (Number(config.nextRunAt || 0) > now) continue;

        const intervalMs = Math.max(1, Number(config.intervalMinutes) || 1) * 60_000;
        const channel = await client.channels.fetch(config.channelId).catch(() => null);
        if (!channel || !channel.isTextBased?.() || typeof channel.send !== 'function') {
          logger.warn('Automatic message channel is unavailable; schedule remains enabled:', config.channelId);
          continue;
        }

        // Advance the schedule first so a slow send or a failed cleanup cannot
        // cause the same due run to fire again on the next scheduler tick.
        await client.db.set(key, {
          ...config,
          nextRunAt: now + intervalMs,
        });

        // Remove the previous automatic post before reposting it.
        if (config.lastMessageId && channel.messages?.fetch) {
          const previousMessage = await channel.messages.fetch(config.lastMessageId).catch(() => null);
          if (previousMessage) {
            await previousMessage.delete().catch((error) => {
              logger.warn('Could not delete the previous automatic message:', error?.message || error);
            });
          }
        }

        const newMessage = await channel.send({
          content: config.message,
          allowedMentions: { parse: [] },
        });

        const sentAt = Date.now();
        await client.db.set(key, {
          ...config,
          lastMessageId: newMessage.id,
          lastSentAt: new Date(sentAt).toISOString(),
          nextRunAt: sentAt + intervalMs,
        });
      } catch (error) {
        logger.error('Automatic message failed for schedule ' + key + ':', error);
      }
    }
  } finally {
    schedulerRunning = false;
  }
}
