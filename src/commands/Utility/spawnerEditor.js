import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

import { loadPrices, persistPrices, postPrices } from './spawner-update.js';

const drafts = new Map();

const SPAWNERS = [
  { key: 'skeleton', name: 'Skeleton', emoji: '<:download:1517708652981780682>', short: 'Skel' },
  { key: 'creeper', name: 'Creeper', emoji: '<:MinecraftCreeperHead:1517707887068315839>', short: 'Creep' },
  { key: 'irongolem', name: 'Iron Golem', emoji: '<:maxresdefault:1517708562489409566>', short: 'Golem' },
];

const FIELDS = [
  { key: 'buy3', label: '3+ Buy' },
  { key: 'buy64', label: '64+ Buy' },
  { key: 'sell3', label: '3+ Sell' },
  { key: 'sell64', label: '64+ Sell' },
];

export function getEditorKey(interaction) {
  return `${interaction.guildId || 'dm'}:${interaction.user.id}`;
}

export function startDraft(interaction) {
  const key = getEditorKey(interaction);
  const prices = loadPrices();
  drafts.set(key, {
    prices: structuredClone(prices),
    messageId: null,
    channelId: null,
  });
  return drafts.get(key);
}

export function getDraft(interaction) {
  return drafts.get(getEditorKey(interaction));
}

export function setPanelLocation(interaction, message) {
  const draft = getDraft(interaction);
  if (!draft) return;
  draft.messageId = message.id;
  draft.channelId = message.channelId;
}

export function updateDraftPrice(interaction, spawner, field, value) {
  const draft = getDraft(interaction) || startDraft(interaction);
  if (!draft.prices[spawner]) return false;
  if (!FIELDS.some((item) => item.key === field)) return false;
  draft.prices[spawner][field] = value.trim();
  return true;
}

export function getPriceLabel(spawner, field) {
  const spawnerName = SPAWNERS.find((item) => item.key === spawner)?.name || spawner;
  const fieldName = FIELDS.find((item) => item.key === field)?.label || field;
  return `${spawnerName} ${fieldName}`;
}

function makeEditButton(spawner, field, value) {
  const spawnerInfo = SPAWNERS.find((item) => item.key === spawner);
  const fieldInfo = FIELDS.find((item) => item.key === field);
  return new ButtonBuilder()
    .setCustomId(`spawner_edit:${spawner}:${field}`)
    .setLabel(`${spawnerInfo.short} ${fieldInfo.label}: ${value}`.slice(0, 80))
    .setStyle(ButtonStyle.Secondary);
}

export function buildEditorPayload(prices) {
  const embed = new EmbedBuilder()
    .setTitle('Spawner Price Editor')
    .setDescription('Every price is separate. Click the exact price you want to change, enter the new value, then press Save.')
    .setColor(0x2b2d31);

  // Discord allows a maximum of 5 component rows per message.
  // Three rows contain the four individual prices for each spawner, and the
  // fourth row contains Save/Cancel.
  const rows = [];

  for (const spawner of SPAWNERS) {
    const price = prices[spawner.key];
    embed.addFields({
      name: `${spawner.emoji} ${spawner.name}`,
      value: FIELDS.map((field) => `**${field.label}:** ${price[field.key]}`).join('\n'),
      inline: false,
    });

    rows.push(new ActionRowBuilder().addComponents(
      ...FIELDS.map((field) => makeEditButton(spawner.key, field.key, price[field.key]))
    ));
  }

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('spawner_editor_save')
      .setLabel('Save & Post All 12 Prices')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('spawner_editor_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
  ));

  return { embeds: [embed], components: rows };
}

export function discardDraft(interaction) {
  drafts.delete(getEditorKey(interaction));
}

export async function saveDraft(interaction, client) {
  const draft = getDraft(interaction);
  if (!draft) throw new Error('Your spawner price editor has expired. Run /spawner-update again.');

  // Save locally first so a posting/permission problem does not lose the new prices.
  persistPrices(draft.prices);
  await postPrices(client, draft.prices);
  discardDraft(interaction);
  return draft.prices;
}
