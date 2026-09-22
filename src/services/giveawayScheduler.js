import { getGuildGiveaways, saveGiveaway, getAutoGiveaways, saveAutoGiveaway } from '../utils/giveaways.js';
import { createGiveawayEmbed, createGiveawayButtons, selectWinners, formatGiveawayWinnerMessage } from './giveawayService.js';
import { logger } from '../utils/logger.js';
import { Mutex } from '../utils/mutex.js';

async function endGiveaway(client, guildId, giveaway) {
  if (giveaway.ended || new Date(giveaway.endsAt).getTime() > Date.now()) return;
  giveaway.ended = true;
  giveaway.isEnded = true;
  giveaway.endedAt = new Date().toISOString();
  giveaway.winnerIds = selectWinners(giveaway.participants || [], giveaway.winnerCount);
  await saveGiveaway(client, guildId, giveaway);

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  const message = channel ? await channel.messages.fetch(giveaway.messageId).catch(() => null) : null;
  if (message) await message.edit({
    content: 'GIVEAWAY ENDED',
    embeds: [createGiveawayEmbed(giveaway, 'ended', giveaway.winnerIds)],
    components: [createGiveawayButtons(true)]
  }).catch(() => null);
  if (channel) await channel.send(formatGiveawayWinnerMessage(giveaway.winnerIds, giveaway.prize)).catch(() => null);
}

async function startAutoGiveaway(client, auto) {
  const channel = await client.channels.fetch(auto.channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return false;
  const now = Date.now();
  const giveaway = {
    id: 'gw-' + now + '-' + Math.random().toString(36).slice(2, 7),
    guildId: auto.guildId,
    channelId: auto.channelId,
    messageId: null,
    prize: auto.prize,
    description: auto.description,
    winnerCount: auto.winnerCount,
    participants: [],
    winnerIds: [],
    startedAt: new Date(now).toISOString(),
    endsAt: new Date(now + auto.durationMs).toISOString(),
    ended: false,
    autoGiveawayId: auto.id
  };
  const message = await channel.send({
    content: '<@&1509955642209603614>',
    allowedMentions: { roles: ['1509955642209603614'] },
    embeds: [createGiveawayEmbed(giveaway)],
    components: [createGiveawayButtons(false)]
  });
  giveaway.messageId = message.id;
  await saveGiveaway(client, auto.guildId, giveaway);
  return true;
}

export async function processGiveawaySchedules(client) {
  const now = Date.now();

  for (const guild of client.guilds.cache.values()) {
    try {
      const giveaways = await getGuildGiveaways(client, guild.id);
      for (const giveaway of giveaways) {
        if (!giveaway.ended && new Date(giveaway.endsAt).getTime() <= now) {
          await endGiveaway(client, guild.id, giveaway);
        }
      }

      const autos = await getAutoGiveaways(client, guild.id);
      for (const auto of autos) {
        const lockKey = `auto-giveaway-schedule:${guild.id}:${auto.id}`;

        await Mutex.runExclusive(lockKey, async () => {
          // Reload inside the lock. A scheduler tick that was already running
          // may have loaded stale data before another tick advanced nextRunAt.
          const currentAutos = await getAutoGiveaways(client, guild.id);
          const current = currentAutos.find(a => a.id === auto.id);
          if (!current || !current.enabled) return;

          const currentNow = Date.now();

          if (current.scheduleEndsAt && new Date(current.scheduleEndsAt).getTime() <= currentNow) {
            current.enabled = false;
            await saveAutoGiveaway(client, guild.id, current);
            return;
          }

          // Re-check after acquiring the lock so only one scheduler invocation
          // can claim a due run.
          if (new Date(current.nextRunAt).getTime() > currentNow) return;

          const started = await startAutoGiveaway(client, current);
          if (!started) return;

          // Advance from the claimed run time, not from a stale copy.
          // If the scheduler was delayed, skip missed intervals rather than
          // creating multiple catch-up giveaways.
          const previousRunAt = new Date(current.nextRunAt).getTime();
          let nextRunAt = previousRunAt + current.repeatMs;
          while (nextRunAt <= currentNow) {
            nextRunAt += current.repeatMs;
          }

          current.nextRunAt = new Date(nextRunAt).toISOString();
          await saveAutoGiveaway(client, guild.id, current);
        });
      }
    } catch (error) {
      logger.error('Giveaway scheduler error for guild ' + guild.id + ':', error);
    }
  }
}
