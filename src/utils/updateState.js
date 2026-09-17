import { getConfigValue, setConfigValue } from '../services/config/guildConfig.js';

const STATE_KEY = '_tigerBotUpdateState';

export async function getUpdateState(client, guildId) {
  if (!client || !guildId) return {};
  try {
    const state = await getConfigValue(client, guildId, STATE_KEY, {});
    return state && typeof state === 'object' ? state : {};
  } catch {
    return {};
  }
}

export async function setUpdateState(client, guildId, patch) {
  if (!client || !guildId) return false;
  try {
    const current = await getUpdateState(client, guildId);
    await setConfigValue(client, guildId, STATE_KEY, {
      ...current,
      ...(patch && typeof patch === 'object' ? patch : {}),
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}
