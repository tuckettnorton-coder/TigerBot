import { logger } from './logger.js';

const giveawayKey = guildId => 'guild:' + guildId + ':giveaways';
const autoKey = guildId => 'guild:' + guildId + ':auto_giveaways';

export async function getGuildGiveaways(client, guildId) {
  try {
    const value = await client.db.get(giveawayKey(guildId), []);
    return Array.isArray(value) ? value : [];
  } catch (error) {
    logger.error('Failed to load giveaways for ' + guildId + ':', error);
    return [];
  }
}

export async function saveGiveaway(client, guildId, giveaway) {
  const giveaways = await getGuildGiveaways(client, guildId);

  // Deterministic scheduled giveaway IDs make retry/recovery idempotent even
  // before a Discord message ID has been saved.
  let index = giveaway.id
    ? giveaways.findIndex(existing => existing.id === giveaway.id)
    : -1;

  // Preserve the legacy message-ID upsert behavior for existing giveaways.
  if (index === -1 && giveaway.messageId) {
    index = giveaways.findIndex(existing => existing.messageId === giveaway.messageId);
  }

  if (index === -1) giveaways.push(giveaway);
  else giveaways[index] = { ...giveaways[index], ...giveaway };

  await client.db.set(giveawayKey(guildId), giveaways);
  return giveaway;
}

export function isGiveawayEnded(giveaway) {
  return Boolean(giveaway && giveaway.endsAt && new Date(giveaway.endsAt).getTime() <= Date.now());
}

export async function getAutoGiveaways(client, guildId) {
  try {
    const value = await client.db.get(autoKey(guildId), []);
    return Array.isArray(value) ? value : [];
  } catch (error) {
    logger.error('Failed to load auto giveaways for ' + guildId + ':', error);
    return [];
  }
}

export async function saveAutoGiveaways(client, guildId, configs) {
  await client.db.set(autoKey(guildId), configs);
  return configs;
}

export async function saveAutoGiveaway(client, guildId, config) {
  const configs = await getAutoGiveaways(client, guildId);
  const index = configs.findIndex(g => g.id === config.id);
  if (index === -1) configs.push(config);
  else configs[index] = config;
  await saveAutoGiveaways(client, guildId, configs);
  return config;
}

export async function removeAutoGiveaway(client, guildId, id) {
  const configs = await getAutoGiveaways(client, guildId);
  await saveAutoGiveaways(client, guildId, configs.filter(g => g.id !== id));
}
