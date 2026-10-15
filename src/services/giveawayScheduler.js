import { getGuildGiveaways, saveGiveaway, getAutoGiveaways, saveAutoGiveaway } from '../utils/giveaways.js';
import { createGiveawayEmbed, createGiveawayButtons, selectWinners, formatGiveawayWinnerMessage } from './giveawayService.js';
import { logger } from '../utils/logger.js';
import { Mutex } from '../utils/mutex.js';

let schedulerRunning = false;

async function disableDuplicateSchedules(client, guildId) {
  return Mutex.runExclusive(`auto-giveaway-configs:${guildId}`, async () => {
  const configs = await getAutoGiveaways(client, guildId);
  const groups = new Map();

  const active = configs
    .filter(config => config.enabled !== false)
    .sort((a, b) => {
      const aCreatedAt = Date.parse(a.createdAt || '');
      const bCreatedAt = Date.parse(b.createdAt || '');
      const aRank = Number.isFinite(aCreatedAt) ? aCreatedAt : Number.MAX_SAFE_INTEGER;
      const bRank = Number.isFinite(bCreatedAt) ? bCreatedAt : Number.MAX_SAFE_INTEGER;
      return aRank - bRank;
    });

  for (const config of active) {
    const createdAt = Date.parse(config.createdAt || '');

    // Treat multiple enabled schedules for the same prize in the same channel
    // as duplicates even if their optional duration/repeat/description settings
    // differ. Those differences were allowing two posts for one giveaway prize.
    const signature = JSON.stringify([
      String(config.channelId || ''),
      String(config.prize || '').trim().toLowerCase(),
    ]);

    const records = groups.get(signature) || [];
    // Keep only one active schedule for a channel/prize combination.
    const match = records[0] || null;

    if (!match) {
      records.push({ createdAt, keeperId: config.id });
      groups.set(signature, records);
      continue;
    }

    // Disable the duplicate schedule and cancel any still-active giveaway
    // that it already posted, so existing duplicate messages do not linger.
    config.enabled = false;
    config.duplicateOf = match.keeperId;
    await saveAutoGiveaway(client, guildId, config);
    await cancelDuplicateScheduleMessages(client, config);

    const duplicateRuns = (await getGuildGiveaways(client, guildId)).filter(
      giveaway => giveaway.autoGiveawayId === config.id && !giveaway.ended && !giveaway.isEnded
    );
    for (const giveaway of duplicateRuns) {
      const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
      const message = channel && giveaway.messageId
        ? await channel.messages.fetch(giveaway.messageId).catch(() => null)
        : null;

      if (message) {
        await message.edit({
          content: '🚫 **Duplicate automatic giveaway canceled.**',
          embeds: [],
          components: [],
        }).catch(error => {
          logger.warn(`Could not update duplicate giveaway message ${giveaway.messageId}:`, error);
        });
      }

      giveaway.ended = true;
      giveaway.isEnded = true;
      giveaway.endedAt = new Date().toISOString();
      giveaway.winnerIds = [];
      giveaway.cancelledByDuplicateSchedule = true;
      await saveGiveaway(client, guildId, giveaway);
    }

    records.push({ createdAt, keeperId: match.keeperId });
    groups.set(signature, records);
    logger.warn(
      `Disabled duplicate automatic giveaway schedule ${config.id}; kept ${match.keeperId} for prize/channel ${config.channelId} / ${config.prize}.`
    );
  }
  });
}

function decodeInvisibleRunKey(content = '') {
  const match = String(content).match(/\u2063([\u200B\u200C]+)\u2063/);
  if (!match || match[1].length % 8 !== 0) return null;

  const bits = match[1].replace(/\u200B/g, '0').replace(/\u200C/g, '1');
  let value = '';
  for (let index = 0; index < bits.length; index += 8) {
    const charCode = Number.parseInt(bits.slice(index, index + 8), 2);
    if (!Number.isFinite(charCode) || charCode < 32 || charCode > 126) return null;
    value += String.fromCharCode(charCode);
  }
  return value;
}

// Disable visible messages from a duplicate schedule even if an earlier
// persistence failure left no database row for one of those messages.
async function cancelDuplicateScheduleMessages(client, config) {
  const channel = await client.channels.fetch(config.channelId).catch(() => null);
  if (!channel?.messages?.fetch) return;

  let before;
  for (let page = 0; page < 5; page += 1) {
    const recent = await channel.messages.fetch(before ? { limit: 100, before } : { limit: 100 })
      .catch(error => {
        logger.warn(`Could not scan messages while cleaning duplicate auto giveaway ${config.id}:`, error);
        return null;
      });
    if (!recent?.size) return;

    for (const message of recent.values()) {
      if (message.author?.id !== client.user?.id) continue;
      if (String(message.content || '').includes('Duplicate automatic giveaway canceled.')) continue;

      const runKey = decodeInvisibleRunKey(message.content || '');
      if (!runKey?.startsWith(`${config.id}:`)) continue;

      await message.edit({
        content: '🚫 **Duplicate automatic giveaway canceled.**',
        embeds: [],
        components: [],
      }).catch(error => {
        logger.warn(`Could not cancel orphaned duplicate giveaway message ${message.id}:`, error);
      });
    }

    before = recent.last()?.id;
    if (!before || recent.size < 100) return;
  }
}

// Encode the run key using zero-width characters. This lets the scheduler find a
// giveaway after a restart even if Discord accepted the send but the DB write
// timed out. It prevents a retry from posting the same scheduled run again.
function makeInvisibleRunMarker(runKey) {
  const bits = [...String(runKey)]
    .map(character => character.charCodeAt(0).toString(2).padStart(8, '0'))
    .join('');
  return '\u2063' + bits.replace(/0/g, '\u200B').replace(/1/g, '\u200C') + '\u2063';
}

async function endGiveaway(client, guildId, giveaway) {
  if (giveaway.ended || new Date(giveaway.endsAt).getTime() > Date.now()) return;

  giveaway.ended = true;
  giveaway.isEnded = true;
  giveaway.endedAt = new Date().toISOString();
  giveaway.winnerIds = selectWinners(giveaway.participants || [], giveaway.winnerCount);

  // Persist the ended state before sending the result announcement. If a
  // scheduler tick overlaps or the process retries, it cannot announce twice.
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

async function findRunMessage(channel, client, marker) {
  // A pending scheduled run is normally only seconds old. Scan enough history to
  // recover one even if the host was offline for a while.
  let before;
  for (let page = 0; page < 5; page += 1) {
    const options = before ? { limit: 100, before } : { limit: 100 };
    const recent = await channel.messages.fetch(options);
    if (!recent.size) return null;

    const match = recent.find(message =>
      message.author?.id === client.user?.id &&
      String(message.content || '').includes(marker)
    );
    if (match) return match;

    before = recent.last()?.id;
    if (!before || recent.size < 100) return null;
  }
  return null;
}

async function startAutoGiveaway(client, auto, scheduledAt) {
  const channel = await client.channels.fetch(auto.channelId).catch(() => null);
  if (!channel?.isTextBased?.() || typeof channel.send !== 'function' || !channel.messages?.fetch) {
    logger.warn(`Automatic giveaway ${auto.id} is waiting: channel ${auto.channelId} is not a fetchable text channel.`);
    return false;
  }

  const scheduledMs = new Date(scheduledAt).getTime();
  if (!Number.isFinite(scheduledMs)) {
    throw new Error(`Automatic giveaway ${auto.id} has an invalid scheduled run time.`);
  }

  const runKey = `${auto.id}:${new Date(scheduledMs).toISOString()}`;
  const giveawayId = `gw-${auto.id}-${scheduledMs}`;

  // If this giveaway was already saved, do not reconstruct it during recovery:
  // participants may have entered since it was posted.
  const priorGiveaways = await getGuildGiveaways(client, auto.guildId);
  if (priorGiveaways.some(existing => existing.id === giveawayId && existing.messageId)) {
    return true;
  }

  const marker = makeInvisibleRunMarker(runKey);
  let message = await findRunMessage(channel, client, marker);

  const startedAtMs = message?.createdTimestamp || Date.now();
  const giveaway = {
    id: giveawayId,
    guildId: auto.guildId,
    channelId: auto.channelId,
    messageId: message?.id || null,
    prize: auto.prize,
    description: auto.description,
    winnerCount: auto.winnerCount,
    participants: [],
    winnerIds: [],
    startedAt: new Date(startedAtMs).toISOString(),
    endsAt: new Date(startedAtMs + auto.durationMs).toISOString(),
    ended: false,
    autoGiveawayId: auto.id,
    scheduledRunAt: new Date(scheduledMs).toISOString(),
  };

  if (!message) {
    message = await channel.send({
      content: `<@&1509955642209603614>\n${marker}`,
      allowedMentions: { roles: ['1509955642209603614'] },
      embeds: [createGiveawayEmbed(giveaway)],
      components: [createGiveawayButtons(false)]
    });
    giveaway.messageId = message.id;
    giveaway.startedAt = new Date(message.createdTimestamp || Date.now()).toISOString();
    giveaway.endsAt = new Date(new Date(giveaway.startedAt).getTime() + auto.durationMs).toISOString();
  }

  // Upsert by deterministic giveaway ID; this also recovers a posted message
  // when the earlier database request failed after Discord accepted the send.
  await saveGiveaway(client, auto.guildId, giveaway);
  return true;
}

export async function processGiveawaySchedules(client) {
  // node-cron fires every second; do not queue multiple ticks behind a slow
  // Discord/DB request, because queued stale ticks can create duplicate work.
  if (schedulerRunning) return;
  schedulerRunning = true;

  try {
    await Mutex.runExclusive('giveaway-scheduler-global', async () => {
      const now = Date.now();

      for (const guild of client.guilds.cache.values()) {
        try {
          const giveaways = await getGuildGiveaways(client, guild.id);
          for (const giveaway of giveaways) {
            if (!giveaway.ended && new Date(giveaway.endsAt).getTime() <= Date.now()) {
              await endGiveaway(client, guild.id, giveaway);
            }
          }

          // The current file-backed fallback supports schedules without a
          // PostgreSQL add-on. Keep schedule state serialized by the shared
          // local mutex; instance locking is handled at bot startup.
          // Keep one active repeating schedule per prize and channel. Any
          // already-posted run from a duplicate schedule is also canceled.
          await disableDuplicateSchedules(client, guild.id);
          // Serialize the scheduler's schedule-array reads/writes with command
          // creation and duplicate cleanup. Otherwise an old nextRunAt write
          // can overwrite a just-created schedule, or let two schedules post.
          await Mutex.runExclusive(`auto-giveaway-configs:${guild.id}`, async () => {
          const autos = await getAutoGiveaways(client, guild.id);
          for (const auto of autos) {
            const lockKey = `auto-giveaway-schedule:${guild.id}:${auto.id}`;

            await Mutex.runExclusive(lockKey, async () => {
              const currentAutos = await getAutoGiveaways(client, guild.id);
              const current = currentAutos.find(a => a.id === auto.id);
              if (!current || !current.enabled) return;

              const currentNow = Date.now();

              // Finish an already-claimed run first, including after a restart.
              let scheduledAt = current.pendingRunAt || null;

              if (!scheduledAt) {
                if (current.scheduleEndsAt && new Date(current.scheduleEndsAt).getTime() <= currentNow) {
                  current.enabled = false;
                  await saveAutoGiveaway(client, guild.id, current);
                  return;
                }

                const dueAt = new Date(current.nextRunAt).getTime();
                if (!Number.isFinite(dueAt) || dueAt > currentNow) return;

                scheduledAt = new Date(dueAt).toISOString();

                // Persist a durable claim before sending anything. If this save
                // fails, nothing is posted. If the process restarts after the
                // send, pendingRunAt lets the next instance recover by marker.
                current.pendingRunAt = scheduledAt;
                await saveAutoGiveaway(client, guild.id, current);
              }

              const started = await startAutoGiveaway(client, current, scheduledAt);
              if (!started) return; // Leave pendingRunAt set; retry safely later.

              const previousRunAt = new Date(scheduledAt).getTime();
              let nextRunAt = previousRunAt + current.repeatMs;
              while (nextRunAt <= currentNow) {
                nextRunAt += current.repeatMs;
              }

              current.nextRunAt = new Date(nextRunAt).toISOString();
              delete current.pendingRunAt;
              await saveAutoGiveaway(client, guild.id, current);
            });
          }
          });
        } catch (error) {
          logger.error('Giveaway scheduler error for guild ' + guild.id + ':', error);
        }
      }
    });
  } finally {
    schedulerRunning = false;
  }
}
