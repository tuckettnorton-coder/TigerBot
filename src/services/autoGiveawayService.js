import { createGiveawayEmbed, createGiveawayButtons } from './giveawayService.js';
import { saveGiveaway, getGuildGiveaways } from '../utils/giveaways.js';

const AUTO_KEY = (guildId) => 'guild:' + guildId + ':auto-giveaway';
const INTERVAL = 24 * 60 * 60 * 1000;
const PING_ROLE_ID = '1509955642209603614';

async function getConfig(client, guildId) { if (!client?.db) return null; return await client.db.get(AUTO_KEY(guildId), null); }
async function setConfig(client, guildId, config) { return client.db.set(AUTO_KEY(guildId), config); }

export async function createAutoGiveaway(client, config) {
  const channel = await client.channels.fetch(config.channelId).catch(() => null);
  if (!channel?.isTextBased()) throw new Error('The automatic giveaway channel could not be found.');
  const now = Date.now();
  const giveaway = { messageId: 'placeholder', channelId: channel.id, guildId: config.guildId, prize: config.prize, description: config.description, hostId: config.hostId, endTime: now + INTERVAL, endsAt: now + INTERVAL, winnerCount: config.winnerCount, participants: [], isEnded: false, ended: false, createdAt: new Date().toISOString(), automatic: true };
  const embed = createGiveawayEmbed(giveaway, 'active');
  if (config.description) embed.setDescription(config.description);
  const message = await channel.send({ content: '<@&' + PING_ROLE_ID + '> Every 24 hours\n🎉 **NEW GIVEAWAY** 🎉', embeds: [embed], components: [createGiveawayButtons(false)], allowedMentions: { roles: [PING_ROLE_ID] } });
  giveaway.messageId = message.id;
  await saveGiveaway(client, config.guildId, giveaway);
  await setConfig(client, config.guildId, { ...config, enabled: true, currentMessageId: message.id, nextEndAt: giveaway.endTime, updatedAt: new Date().toISOString() });
  return giveaway;
}

export async function enableAutoGiveaway(client, config) {
  if (!client?.db) throw new Error('Database is not available.');
  const savedConfig = { ...config, enabled: true, currentMessageId: null, nextEndAt: null, updatedAt: new Date().toISOString() };
  await setConfig(client, config.guildId, savedConfig);
  try { return await createAutoGiveaway(client, savedConfig); } catch (error) { await setConfig(client, config.guildId, { ...savedConfig, enabled: false }); throw error; }
}
export async function disableAutoGiveaway(client, guildId) { const current = await getConfig(client, guildId); if (!current) return false; await setConfig(client, guildId, { ...current, enabled: false, updatedAt: new Date().toISOString() }); return true; }
export async function getAutoGiveawayConfig(client, guildId) { return getConfig(client, guildId); }

export async function checkAutoGiveaways(client) {
  if (!client?.db) return;
  for (const guild of client.guilds.cache.values()) {
    try {
      const config = await getConfig(client, guild.id);
      if (!config?.enabled || !config.currentMessageId || Date.now() < Number(config.nextEndAt || 0)) continue;
      const active = (await getGuildGiveaways(client, guild.id)).find(g => g.messageId === config.currentMessageId);
      if (active && !active.ended && !active.isEnded) continue;
      await createAutoGiveaway(client, config);
    } catch (error) { console.error('[AutoGiveaway] Failed for guild ' + guild.id + ': ' + error.message); }
  }
}