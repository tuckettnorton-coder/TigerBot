import { getGuildGiveaways, saveGiveaway, getAutoGiveaways, saveAutoGiveaway } from '../utils/giveaways.js';
import { createGiveawayEmbed, createGiveawayButtons, selectWinners } from './giveawayService.js';
import { logger } from '../utils/logger.js';

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
  if (channel) await channel.send(
    giveaway.winnerIds.length
      ? 'Giveaway winner(s): ' + giveaway.winnerIds.map(id => '<@' + id + '>').join(', ') + ' — congratulations!'
      : 'The giveaway ended with no valid entries.'
  ).catch(() => null);
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
        if (!auto.enabled) continue;
        if (auto.scheduleEndsAt && new Date(auto.scheduleEndsAt).getTime() <= now) {
          auto.enabled = false;
          await saveAutoGiveaway(client, guild.id, auto);
          continue;
        }
        if (new Date(auto.nextRunAt).getTime() <= now) {
          const started = await startAutoGiveaway(client, auto);
          if (started) {
            do {
              auto.nextRunAt = new Date(new Date(auto.nextRunAt).getTime() + auto.repeatMs).toISOString();
            } while (new Date(auto.nextRunAt).getTime() <= now);
            await saveAutoGiveaway(client, guild.id, auto);
          }
        }
      }
    } catch (error) {
      logger.error('Giveaway scheduler error for guild ' + guild.id + ':', error);
    }
  }
}
