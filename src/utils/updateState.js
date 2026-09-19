const STATE_PREFIX = 'guild:';
const STATE_SUFFIX = ':tigerbot:update-state';

function stateKey(guildId) {
  return STATE_PREFIX + guildId + STATE_SUFFIX;
}

export async function getUpdateState(client, guildId) {
  if (!client?.db || !guildId) return {};
  try {
    const state = await client.db.get(stateKey(guildId), {});
    return state && typeof state === 'object' ? state : {};
  } catch {
    return {};
  }
}

export async function setUpdateState(client, guildId, patch) {
  if (!client?.db || !guildId) return false;
  try {
    const current = await getUpdateState(client, guildId);
    const next = {
      ...current,
      ...(patch && typeof patch === 'object' ? patch : {}),
      updatedAt: new Date().toISOString(),
    };
    const saved = await client.db.set(stateKey(guildId), next);
    return saved !== false;
  } catch {
    return false;
  }
}

/** Read the latest saved value for an individual update type. */
export async function getLatestUpdateData(client, guildId, key, fallback = null) {
  const state = await getUpdateState(client, guildId);
  return state[key] !== undefined ? state[key] : fallback;
}

export function getUpdateStateKey(guildId) {
  return stateKey(guildId);
}
