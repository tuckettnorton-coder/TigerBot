import { db } from '../utils/database.js';

const transcripts = new Map();
const messageToToken = new Map();
const TRANSCRIPT_PREFIX = 'transcripts:';
const MESSAGE_PREFIX = 'transcript_messages:';
const TICKET_OWNER_PREFIX = 'ticket_owners:';
const CLOSE_REQUEST_PREFIX = 'close_requests:';

export async function saveCloseRequest(ticketId, expiresAt) {
  if (!ticketId || !Number.isFinite(Number(expiresAt))) return;
  const value = { ticketId: String(ticketId), expiresAt: Number(expiresAt) };
  try {
    if (!db.initialized) await db.initialize();
    if (db.isAvailable?.() && typeof db.set === 'function') {
      await db.set(`${CLOSE_REQUEST_PREFIX}${ticketId}`, value);
    }
  } catch (error) {
    console.warn(`Could not persist close request ${ticketId}: ${error.message}`);
  }
}

export async function getCloseRequest(ticketId) {
  if (!ticketId) return null;
  try {
    if (!db.initialized) await db.initialize();
    if (db.isAvailable?.() && typeof db.get === 'function') {
      const saved = await db.get(`${CLOSE_REQUEST_PREFIX}${ticketId}`, null);
      if (saved?.expiresAt) return { ticketId: String(ticketId), expiresAt: Number(saved.expiresAt) };
    }
  } catch (error) {
    console.warn(`Could not load close request ${ticketId}: ${error.message}`);
  }
  return null;
}

export async function clearCloseRequest(ticketId) {
  if (!ticketId) return;
  try {
    if (!db.initialized) await db.initialize();
    if (db.isAvailable?.() && typeof db.delete === 'function') {
      await db.delete(`${CLOSE_REQUEST_PREFIX}${ticketId}`);
    }
  } catch (error) {
    console.warn(`Could not clear close request ${ticketId}: ${error.message}`);
  }
}

export async function listCloseRequests() {
  try {
    if (!db.initialized) await db.initialize();
    if (db.isAvailable?.() && typeof db.list === 'function') {
      const keys = await db.list(CLOSE_REQUEST_PREFIX);
      const requests = [];
      for (const key of keys) {
        const saved = await db.get(key, null);
        if (saved?.ticketId && saved?.expiresAt) {
          requests.push({ ticketId: String(saved.ticketId), expiresAt: Number(saved.expiresAt) });
        }
      }
      return requests;
    }
  } catch (error) {
    console.warn(`Could not list persisted close requests: ${error.message}`);
  }
  return [];
}


function encode(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function decode(value) {
  return Buffer.from(value, 'base64');
}

export async function storeTranscript(token, buffer, fileName) {
  const entry = { buffer, fileName, createdAt: Date.now() };
  transcripts.set(token, entry);
  try {
    if (!db.initialized) await db.initialize();
    if (db.isAvailable?.() && typeof db.set === 'function') {
      await db.set(`${TRANSCRIPT_PREFIX}${token}`, { fileName, createdAt: entry.createdAt, buffer: encode(buffer) });
    }
  } catch (error) {
    console.warn(`Could not persist transcript ${token}: ${error.message}`);
  }
}

export async function getTranscript(token) {
  if (!token) return null;
  const cached = transcripts.get(token);
  if (cached) return cached;
  try {
    if (!db.initialized) await db.initialize();
    if (db.isAvailable?.() && typeof db.get === 'function') {
      const saved = await db.get(`${TRANSCRIPT_PREFIX}${token}`, null);
      if (saved?.buffer && saved?.fileName) {
        const entry = { buffer: decode(saved.buffer), fileName: saved.fileName, createdAt: Number(saved.createdAt) || Date.now() };
        transcripts.set(token, entry);
        return entry;
      }
    }
  } catch (error) {
    console.warn(`Could not load transcript ${token}: ${error.message}`);
  }
  return null;
}

export async function bindTranscriptMessage(messageId, token) {
  messageToToken.set(messageId, token);
  try {
    if (!db.initialized) await db.initialize();
    if (db.isAvailable?.() && typeof db.set === 'function') {
      await db.set(`${MESSAGE_PREFIX}${messageId}`, token);
    }
  } catch (error) {
    console.warn(`Could not persist transcript message mapping ${messageId}: ${error.message}`);
  }
}

export async function getTranscriptForMessage(messageId) {
  if (!messageId) return null;
  let token = messageToToken.get(messageId);
  if (!token) {
    try {
      if (!db.initialized) await db.initialize();
      if (db.isAvailable?.() && typeof db.get === 'function') {
        token = await db.get(`${MESSAGE_PREFIX}${messageId}`, null);
        if (token) messageToToken.set(messageId, token);
      }
    } catch (error) {
      console.warn(`Could not load transcript mapping ${messageId}: ${error.message}`);
    }
  }
  return token ? getTranscript(token) : null;
}


export async function bindTicketOwner(ticketId, ownerId) {
  if (!ticketId || !ownerId) return;
  try {
    if (!db.initialized) await db.initialize();
    if (db.isAvailable?.() && typeof db.set === 'function') {
      await db.set(`${TICKET_OWNER_PREFIX}${ticketId}`, String(ownerId));
    }
  } catch (error) {
    console.warn(`Could not persist ticket owner ${ticketId}: ${error.message}`);
  }
}

export async function getTicketOwner(ticketId) {
  if (!ticketId) return null;
  try {
    if (!db.initialized) await db.initialize();
    if (db.isAvailable?.() && typeof db.get === 'function') {
      const ownerId = await db.get(`${TICKET_OWNER_PREFIX}${ticketId}`, null);
      return ownerId ? String(ownerId) : null;
    }
  } catch (error) {
    console.warn(`Could not load ticket owner ${ticketId}: ${error.message}`);
  }
  return null;
}
