const drafts = new Map();
export function setBuildingDraft(userId, data) { drafts.set(userId, { ...(drafts.get(userId) || {}), ...data, updatedAt: Date.now() }); }
export function getBuildingDraft(userId) { return drafts.get(userId) || {}; }
export function clearBuildingDraft(userId) { drafts.delete(userId); }
