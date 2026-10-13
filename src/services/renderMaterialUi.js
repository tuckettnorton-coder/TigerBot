import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';

const materialStore = new Map();
const STORE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_STORED_RENDERED_SCHEMATICS = 500;
const MATERIAL_PAGE_CHAR_LIMIT = 3000;

function removeExpiredEntries(now = Date.now()) {
  for (const [key, value] of materialStore) {
    if (value.expiresAt <= now) materialStore.delete(key);
  }
}

export function saveRenderMaterials(id, data) {
  removeExpiredEntries();
  materialStore.set(id, {
    name: String(data.name || 'Minecraft Schematic'),
    size: Array.isArray(data.size) ? [...data.size] : [0, 0, 0],
    total: Number(data.total) || 0,
    counts: Array.isArray(data.counts) ? data.counts.map(([name, count]) => [String(name), Number(count) || 0]) : [],
    expiresAt: Date.now() + STORE_TTL_MS
  });

  while (materialStore.size > MAX_STORED_RENDERED_SCHEMATICS) {
    materialStore.delete(materialStore.keys().next().value);
  }
}

export function getRenderMaterials(id) {
  if (!id) return null;
  const entry = materialStore.get(id);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    materialStore.delete(id);
    return null;
  }
  return entry;
}

export function formatMaterialName(name) {
  return String(name).replace(/^minecraft:/, '').replace(/_/g, ' ');
}

export function getMaterialPages(entry) {
  const lines = (entry?.counts || []).map(([name, count]) =>
    '• ' + formatMaterialName(name).slice(0, 120) +
    ' — **' + Number(count).toLocaleString('en-US') + '**'
  );
  if (!lines.length) return [['No non-air materials were found in this schematic.']];

  const pages = [];
  let page = [];
  let pageLength = 0;
  for (const line of lines) {
    const extraLength = line.length + (page.length ? 1 : 0);
    if (page.length && pageLength + extraLength > MATERIAL_PAGE_CHAR_LIMIT) {
      pages.push(page);
      page = [];
      pageLength = 0;
    }
    page.push(line);
    pageLength += line.length + (page.length > 1 ? 1 : 0);
  }
  if (page.length) pages.push(page);
  return pages;
}

export function buildMaterialsEmbed(entry, page = 0) {
  const pages = getMaterialPages(entry);
  const safePage = Math.max(0, Math.min(pages.length - 1, Number(page) || 0));
  const start = pages.slice(0, safePage).reduce((sum, current) => sum + current.length, 0);
  const displayedCount = pages[safePage].filter(line => line.startsWith('• ')).length;
  const end = start + displayedCount;

  let description =
    '**Structure:** ' + entry.name.slice(0, 180) + '\n' +
    '**Dimensions:** ' + entry.size.join(' × ') + ' blocks\n' +
    '**Non-air blocks:** ' + entry.total.toLocaleString('en-US') + '\n' +
    '**Material types:** ' + entry.counts.length.toLocaleString('en-US') + '\n\n' +
    '**Materials**\n' + pages[safePage].join('\n');

  if (pages.length > 1) {
    description += '\n\n**Showing:** ' + (start + 1).toLocaleString('en-US') +
      '–' + end.toLocaleString('en-US') + ' of ' +
      entry.counts.length.toLocaleString('en-US') + ' materials · Page ' +
      (safePage + 1) + '/' + pages.length;
  }

  return new EmbedBuilder()
    .setTitle('🧱 Material List')
    .setDescription(description)
    .setFooter({ text: 'Private material list · Press Dismiss when finished' });
}

export function buildMaterialComponents(id, entry, page = 0) {
  const pages = getMaterialPages(entry);
  const safePage = Math.max(0, Math.min(pages.length - 1, Number(page) || 0));
  const controls = [];

  if (pages.length > 1) {
    controls.push(
      new ButtonBuilder()
        .setCustomId('render_material_page:' + id + ':' + (safePage - 1))
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage === 0),
      new ButtonBuilder()
        .setCustomId('render_material_page:' + id + ':' + (safePage + 1))
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= pages.length - 1)
    );
  }

  controls.push(
    new ButtonBuilder()
      .setCustomId('render_material_dismiss:' + id)
      .setLabel('Dismiss')
      .setStyle(ButtonStyle.Danger)
  );

  return [new ActionRowBuilder().addComponents(controls)];
}
