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

        const channel = await client.channels.fetch(config.channelId).catch(() => null);
        if (!channel || !channel.isTextBased?.() || typeof channel.send !== 'function') {
          logger.warn('Automatic message channel is unavailable; schedule remains enabled:', config.channelId);
          continue;
        }

        await channel.send({
          content: config.message,
          allowedMentions: { parse: [] },
        });

        // Schedule from the successful send time so delayed runs do not spam catch-up posts.
        const sentAt = Date.now();
        await client.db.set(key, {
          ...config,
          nextRunAt: sentAt + Math.max(1, Number(config.intervalMinutes) || 1) * 60_000,
          lastSentAt: new Date(sentAt).toISOString(),
        });
      } catch (error) {
        logger.error('Automatic message failed for schedule ' + key + ':', error);
      }
    }
  } finally {
    schedulerRunning = false;
  }
}
