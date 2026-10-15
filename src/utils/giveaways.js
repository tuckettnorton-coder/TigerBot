import { logger } from './logger.js';
import { Mutex } from './mutex.js';

const giveawayKey = guildId => 'guild:' + guildId + ':giveaways';
const autoKey = guildId => 'guild:' + guildId + ':auto_giveaways';

function getPersistentGiveawayStore(client) {
  const store = client?.db?.db;
  if (client?.db?.isDegraded?.()) return null;
  return store
    && typeof store.getGiveawaysByGuild === 'function'
    && typeof store.upsertGiveaway === 'function'
    ? store
    : null;
}

export async function getGuildGiveaways(client, guildId) {
  try {
    const store = getPersistentGiveawayStore(client);
    if (store) {
      return await store.getGiveawaysByGuild(guildId);
    }

    const value = await client.db.get(giveawayKey(guildId), []);
    return Array.isArray(value) ? value : [];
  } catch (error) {
    logger.error('Failed to load giveaways for ' + guildId + ':', error);
    // Do not turn a storage failure into an empty list. Doing so can make a
    // live message look orphaned and cause the scheduler to post it again.
    throw error;
  }
}

export async function saveGiveaway(client, guildId, giveaway) {
  if (!giveaway?.messageId) {
    throw new Error('Cannot save a giveaway before it has a Discord message ID.');
  }

  try {
    const store = getPersistentGiveawayStore(client);
    if (store) {
      const saved = await store.upsertGiveaway(guildId, giveaway);
      if (saved !== true) throw new Error('PostgreSQL did not confirm the giveaway save.');
      return giveaway;
    }

    // A fallback store uses a single value per guild. Serialize all
    // read-modify-write operations so two button clicks or scheduler updates
    // cannot overwrite each other's giveaway records.
    return await Mutex.runExclusive(`giveaway-store:${guildId}`, async () => {
      const giveaways = await getGuildGiveaways(client, guildId);
      let index = giveaway.id
        ? giveaways.findIndex(existing => existing.id === giveaway.id)
        : -1;

      // Upsert by Discord message ID for older giveaway records.
      if (index === -1) {
        index = giveaways.findIndex(existing => String(existing.messageId) === String(giveaway.messageId));
      }

      if (index === -1) giveaways.push(giveaway);
      else giveaways[index] = { ...giveaways[index], ...giveaway };

      const saved = await client.db.set(giveawayKey(guildId), giveaways);
      if (saved === false) throw new Error('Database did not confirm the giveaway save.');
      return giveaway;
    });
  } catch (error) {
    logger.error('Failed to save giveaway ' + (giveaway?.messageId || '(without message ID)') + ':', error);
    throw error;
  }
}

export async function removeGiveaway(client, guildId, messageId) {
  const store = getPersistentGiveawayStore(client);
  if (store && typeof store.deleteGiveawayByMessageId === 'function') {
    await store.deleteGiveawayByMessageId(guildId, messageId);
    return true;
  }

  return await Mutex.runExclusive(`giveaway-store:${guildId}`, async () => {
    const giveaways = await getGuildGiveaways(client, guildId);
    const filtered = giveaways.filter(giveaway => String(giveaway.messageId) !== String(messageId));
    const saved = await client.db.set(giveawayKey(guildId), filtered);
    if (saved === false) throw new Error('Database did not confirm the giveaway removal.');
    return true;
  });
}

export function isGiveawayEnded(giveaway) {
  return Boolean(giveaway && giveaway.endsAt && new Date(giveaway.endsAt).getTime() <= Date.now());
}

export async function getAutoGiveaways(client, guildId) {
  try {
    const value = await client.db.get(autoKey(guildId), []);
    return Array.isArray(value) ? value : [];
  } catch (error) {
    logger.error('Failed to load automatic giveaways for ' + guildId + ':', error);
    throw error;
  }
}

export async function saveAutoGiveaways(client, guildId, configs) {
  const saved = await client.db.set(autoKey(guildId), configs);
  if (saved === false) {
    throw new Error('Database did not confirm the automatic giveaway schedules were saved.');
  }
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
