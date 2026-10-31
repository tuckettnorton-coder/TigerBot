import { randomUUID } from 'node:crypto';

const drafts = new Map();
const DRAFT_DURATION_MS = 15 * 60 * 1000;

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

export function startShulkerDraft(guildId, userId, shulkerCount) {
  const draft = {
    sessionId: randomUUID(),
    createdAt: Date.now(),
    shulkerCount,
    primary: null,
    includeInventory: false,
    includeHotbar: false,
    screenshots: {},
    completing: false,
  };
  drafts.set(key(guildId, userId), draft);
  return draft;
}

export function getShulkerDraft(guildId, userId, sessionId) {
  const id = key(guildId, userId);
  const draft = drafts.get(id);
  if (!draft) return null;
  if (Date.now() - draft.createdAt > DRAFT_DURATION_MS) {
    drafts.delete(id);
    return null;
  }
  return draft.sessionId === sessionId ? draft : null;
}

export function patchShulkerDraft(guildId, userId, sessionId, values) {
  const draft = getShulkerDraft(guildId, userId, sessionId);
  if (!draft) return null;
  Object.assign(draft, values);
  return draft;
}

export function clearShulkerDraft(guildId, userId) {
  drafts.delete(key(guildId, userId));
}
