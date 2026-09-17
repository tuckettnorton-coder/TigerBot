const drafts = new Map();

export function setMiddlemanDraft(userId, data) {
  drafts.set(userId, { ...(drafts.get(userId) || {}), ...data, updatedAt: Date.now() });
}

export function getMiddlemanDraft(userId) {
  return drafts.get(userId) || null;
}

export function clearMiddlemanDraft(userId) {
  drafts.delete(userId);
}
