import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve('schematic_data');
const FILES_DIR = path.join(DATA_DIR, 'files');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');
const MAX_OPTIONS = 25;

async function ensureStorage() {
  await mkdir(FILES_DIR, { recursive: true });
}

async function loadEntries() {
  await ensureStorage();
  try {
    const raw = await readFile(INDEX_FILE, 'utf8');
    const entries = JSON.parse(raw);
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return [];
    throw error;
  }
}

async function saveEntries(entries) {
  await ensureStorage();
  await writeFile(INDEX_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

function safeFileName(name) {
  return String(name || 'schematic').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
}

export async function listSchematics() {
  return loadEntries();
}

export async function addSchematic({ title, filename, buffer, uploadedBy }) {
  const id = crypto.randomBytes(4).toString('hex');
  const storedName = id + '_' + safeFileName(filename);
  await ensureStorage();
  await writeFile(path.join(FILES_DIR, storedName), buffer);

  const entries = await loadEntries();
  entries.push({
    id,
    title: String(title || '').trim().slice(0, 100),
    filename: filename || 'schematic',
    storedName,
    uploadedBy: String(uploadedBy),
    uploadedAt: new Date().toISOString(),
  });
  await saveEntries(entries);
  return entries.at(-1);
}

export async function getSchematic(id) {
  const entries = await loadEntries();
  const entry = entries.find((item) => item.id === id);
  if (!entry) return null;
  return { ...entry, path: path.join(FILES_DIR, entry.storedName) };
}

export { MAX_OPTIONS };
