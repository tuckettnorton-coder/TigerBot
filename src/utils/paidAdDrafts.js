const drafts = new Map();

export function setPaidAdDraft(userId, data) {
  drafts.set(userId, { ...(drafts.get(userId) || {}), ...data, updatedAt: Date.now() });
}

export function getPaidAdDraft(userId) { return drafts.get(userId) || null; }
export function clearPaidAdDraft(userId) { drafts.delete(userId); }
