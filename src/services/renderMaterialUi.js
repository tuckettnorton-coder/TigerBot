import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder
} from 'discord.js';

const materialStore = new Map();
const STORE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_STORED_RENDERED_SCHEMATICS = 500;
const MATERIALS_PER_PAGE = 25;

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

export function buildMaterialsEmbed(entry, page = 0) {
  const totalPages = Math.max(1, Math.ceil(entry.counts.length / MATERIALS_PER_PAGE));
  const safePage = Math.max(0, Math.min(totalPages - 1, Number(page) || 0));
  const start = safePage * MATERIALS_PER_PAGE;
  const end = Math.min(entry.counts.length, start + MATERIALS_PER_PAGE);

  let description =
    '**Structure:** ' + entry.name.slice(0, 180) + '\n' +
    '**Dimensions:** ' + entry.size.join(' × ') + ' blocks\n' +
    '**Non-air blocks:** ' + entry.total.toLocaleString('en-US') + '\n' +
    '**Material types:** ' + entry.counts.length.toLocaleString('en-US') + '\n\n';

  if (entry.counts.length) {
    description +=
      'Use the dropdown to switch between material types; each option already shows its count.\n' +
      '**Showing:** ' + (start + 1).toLocaleString('en-US') + '–' +
      end.toLocaleString('en-US') + ' of ' + entry.counts.length.toLocaleString('en-US') + ' types.';
  } else {
    description += 'No non-air materials were found in this schematic.';
  }

  return new EmbedBuilder()
    .setTitle('🧱 Material List')
    .setDescription(description)
    .setFooter({ text: 'Private material browser · Only visible to you · Expires after 6 hours' });
}

export function buildMaterialComponents(id, entry, page = 0) {
  if (!entry.counts.length) return [];

  const totalPages = Math.max(1, Math.ceil(entry.counts.length / MATERIALS_PER_PAGE));
  const safePage = Math.max(0, Math.min(totalPages - 1, Number(page) || 0));
  const start = safePage * MATERIALS_PER_PAGE;
  const end = Math.min(entry.counts.length, start + MATERIALS_PER_PAGE);
  const options = entry.counts.slice(start, end).map(([name, count], offset) => ({
    label: formatMaterialName(name).slice(0, 100) || 'Unknown block',
    description: 'Count: ' + count.toLocaleString('en-US'),
    value: String(start + offset)
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId('render_material_picker:' + id + ':' + safePage)
    .setPlaceholder('Select a material type · counts shown beside names')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(options);

  const rows = [new ActionRowBuilder().addComponents(select)];

  if (totalPages > 1) {
    const navigation = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('render_material_page:' + id + ':' + (safePage - 1))
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage === 0),
      new ButtonBuilder()
        .setCustomId('render_material_page:' + id + ':' + (safePage + 1))
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= totalPages - 1)
    );
    rows.push(navigation);
  }

  return rows;
}
