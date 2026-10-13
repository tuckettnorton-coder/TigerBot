import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const viewStore = new Map();
const VIEW_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_VIEW_ENTRIES = 40;
const MAX_CACHED_BLOCKS = 250_000;
let cachedBlockCount = 0;

const POV_BUTTON_LABELS = {
  1: 'Front',
  2: 'Opposite',
  3: 'Under',
  4: 'Top −1',
  5: 'Top −2',
  6: 'Top −3',
  7: 'Top −4',
  8: 'Half · Front',
  9: 'Half · Back',
  10: 'Half · Side'
};

export function getPovButtonLabel(pov) {
  return POV_BUTTON_LABELS[Number(pov)] || 'POV ' + String(pov);
}


function deleteEntry(id) {
  const entry = viewStore.get(id);
  if (entry) cachedBlockCount -= entry.data.blocks?.length || 0;
  viewStore.delete(id);
}

function removeExpiredEntries(now = Date.now()) {
  for (const [id, entry] of viewStore) {
    if (entry.expiresAt <= now) deleteEntry(id);
  }
}

export function saveRenderView(id, data) {
  removeExpiredEntries();
  deleteEntry(id);

  const entry = {
    data,
    expiresAt: Date.now() + VIEW_TTL_MS
  };
  viewStore.set(id, entry);
  cachedBlockCount += data.blocks?.length || 0;

  while (viewStore.size > MAX_VIEW_ENTRIES || cachedBlockCount > MAX_CACHED_BLOCKS) {
    const oldestId = viewStore.keys().next().value;
    if (oldestId === undefined) break;
    deleteEntry(oldestId);
  }
}

export function getRenderView(id) {
  if (!id) return null;
  const entry = viewStore.get(id);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    deleteEntry(id);
    return null;
  }
  // Refresh the entry's position in the map so frequently used previews remain.
  viewStore.delete(id);
  viewStore.set(id, entry);
  return entry.data;
}

export function buildRenderViewComponents(id, activePov = 1) {
  const firstPovRow = new ActionRowBuilder().addComponents(
    [1, 2, 3, 4, 5].map(pov => new ButtonBuilder()
      .setCustomId('render_pov:' + id + ':' + pov)
      .setLabel(getPovButtonLabel(pov))
      .setStyle(Number(activePov) === pov ? ButtonStyle.Primary : ButtonStyle.Secondary)
    )
  );

  const secondPovRow = new ActionRowBuilder().addComponents(
    [6, 7, 8, 9, 10].map(pov => new ButtonBuilder()
      .setCustomId('render_pov:' + id + ':' + pov)
      .setLabel(String(pov))
      .setStyle(Number(activePov) === pov ? ButtonStyle.Primary : ButtonStyle.Secondary)
    )
  );

  const materialsButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('render_materials:' + id)
      .setLabel('Materials List')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🧱')
  );

  // Discord permits five buttons per row and five action rows per message.
  // Keep ten POVs in two compact rows, with the material list underneath.
  return [firstPovRow, secondPovRow, materialsButton];
}
