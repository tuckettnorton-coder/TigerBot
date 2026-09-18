const transcripts = new Map();

export function storeTranscript(token, buffer, fileName) {
  transcripts.set(token, { buffer, fileName, createdAt: Date.now() });

  // Keep memory bounded. Transcripts older than 24 hours are removed.
  setTimeout(() => {
    const entry = transcripts.get(token);
    if (entry && Date.now() - entry.createdAt >= 24 * 60 * 60 * 1000) {
      transcripts.delete(token);
    }
  }, 24 * 60 * 60 * 1000).unref?.();
}

export function getTranscript(token) {
  return transcripts.get(token) || null;
}
