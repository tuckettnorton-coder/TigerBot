import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUpdateState, setUpdateState, getLatestUpdateDataFast } from '../../utils/updateState.js';
import { upsertUpdateMessage } from '../../utils/updateMessage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPAWNER_PRICE_CHANNEL_ID = '1504948495948452001';
const TICKET_CHANNEL_ID = '1504949441650622575';
const SPAWNER_UPDATE_ROLE_ID = '1509955955063001218';
const DATA_FILE = path.join(__dirname, 'spawnerPrices.json');
const MESSAGE_FILE = path.join(__dirname, 'spawnerPriceMessage.json');


const EMOJI_SKELETON = '<:download:1517708652981780682>';
const EMOJI_CREEPER = '<:MinecraftCreeperHead:1517707887068315839>';
const EMOJI_IRONGOLEM = '<:maxresdefault:1517708562489409566>';
const EMOJI_ZOMBIFIED_PIGLIN = '<:MinecraftZombiePigmanHead:1517710362282295366>';
const EMOJI_BLAZE = '<:637788972315478693:1517707785200996523>';
const EMOJI_COW = '<:images:1524079570758930714>';
const EMOJI_PIG = '<:images:1524079437400899736>';

const ZERO_PRICES = { buy3: '0', buy64: '0', sell3: '0', sell64: '0' };
const DEFAULT_PRICES = {
  skeleton: { buy3: '9M', buy64: '8.9M', sell3: '7.5M', sell64: '7.6M' },
  creeper: { buy3: '13M', buy64: '12M', sell3: '8M', sell64: '7M' },
  irongolem: { buy3: '18M', buy64: '17M', sell3: '8M', sell64: '9M' },
  zombifiedpiglin: { ...ZERO_PRICES },
  blaze: { ...ZERO_PRICES },
  cow: { ...ZERO_PRICES },
  pig: { ...ZERO_PRICES },
};

function cloneDefaults() { return JSON.parse(JSON.stringify(DEFAULT_PRICES)); }

function mergeWithDefaults(source = {}) {
  const prices = cloneDefaults();
  for (const key of Object.keys(DEFAULT_PRICES)) {
    prices[key] = { ...prices[key], ...(source?.[key] || {}) };
  }
  return prices;
}

export function loadPrices() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return mergeWithDefaults(parsed);
  } catch { return cloneDefaults(); }
}

export function mergePrices(source = {}) {
  const prices = loadPrices();
  for (const key of Object.keys(DEFAULT_PRICES)) {
    prices[key] = { ...prices[key], ...(source?.[key] || {}) };
  }
  return prices;
}

function savePrices(prices) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(prices, null, 2)}\n`, 'utf8');
}

function loadMessageId() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MESSAGE_FILE, 'utf8'));
    return parsed.messageId || null;
  } catch { return null; }
}

function saveMessageId(messageId) {
  fs.writeFileSync(MESSAGE_FILE, `${JSON.stringify({ messageId }, null, 2)}\n`, 'utf8');
}

function formatSpawnerSection(prices, key, label, emoji) {
  const price = prices[key];
  return [
    `${emoji} **${label} Spawners**`,
    '**(You buy from us)**',
    `**3+ Buy:** ${price.buy3}  **64+ Buy:** ${price.buy64}`,
    '**(You sell to us)**',
    `**3+ Sell:** ${price.sell3}  **64+ Sell:** ${price.sell64}`,
  ].join('\n');
}

export function formatPriceMessage(prices) {
  const sections = [
    formatSpawnerSection(prices, 'skeleton', 'Skeleton', EMOJI_SKELETON),
    formatSpawnerSection(prices, 'creeper', 'Creeper', EMOJI_CREEPER),
    formatSpawnerSection(prices, 'irongolem', 'Iron Golem', EMOJI_IRONGOLEM),
    formatSpawnerSection(prices, 'zombifiedpiglin', 'Zombified Piglin', EMOJI_ZOMBIFIED_PIGLIN),
    formatSpawnerSection(prices, 'blaze', 'Blaze', EMOJI_BLAZE),
    formatSpawnerSection(prices, 'cow', 'Cow', EMOJI_COW),
    formatSpawnerSection(prices, 'pig', 'Pig', EMOJI_PIG),
  ];
  const note = [
    `### __NOTE__- WE DON'T GO FIRST FOR BUYING/SELLING SPAWNERS MAKE A <#${TICKET_CHANNEL_ID}>`,
    '# MINIMUM 3+',
    `**ALL messages** regarding your ticket / spawners will be IN THE TICKET ONLY!! Scammers can SEE your ticket but not the messages inside, **dont get fooled by this**! <@&${SPAWNER_UPDATE_ROLE_ID}>`,
  ].join('\n');
  return `${sections.join('\n\n')}\n\n${note}`;
}

export const data = new SlashCommandBuilder()
  .setName('spawner-update')
  .setDescription('Update all 28 spawner prices')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction, guildConfig, client) {
  const { buildSpawnerPriceModal } = await import('../../interactions/modals/spawner_update_modal.js');
  const saved = await getLatestUpdateDataFast(client, interaction.guildId, 'spawnerPrices', null);
  await interaction.showModal(buildSpawnerPriceModal(mergePrices(saved || {}), 1));
}

export default { data, execute };

export function persistPrices(prices) { savePrices(prices); }

function isSpawnerPriceMessage(message) {
  const text = message.content || '';
  return text.includes('**Skeleton Spawners**')
    && text.includes('**Creeper Spawners**')
    && text.includes('**Iron Golem Spawners**')
    && text.includes('MINIMUM 3+');
}

export async function postPrices(client, prices) {
  const channel = await client.channels.fetch(SPAWNER_PRICE_CHANNEL_ID).catch(() => null);
  if (!channel || typeof channel.send !== 'function') {
    throw new Error(`Spawner price channel ${SPAWNER_PRICE_CHANNEL_ID} is not a sendable channel.`);
  }

  const state = await getUpdateState(client, channel.guild.id);
  const messageContent = formatPriceMessage(prices);
  await upsertUpdateMessage({
    client,
    channel,
    content: messageContent,
    matches: isSpawnerPriceMessage,
    previousMessageIds: [state.spawnerPriceMessageId, loadMessageId()],
    label: 'spawner prices',
    onSaved: async (message) => {
      saveMessageId(message.id);
      await setUpdateState(client, channel.guild.id, {
        spawnerPriceMessageId: message.id,
        spawnerPriceChannelId: channel.id,
        spawnerPrices: prices,
        spawnerPriceMessage: messageContent,
      });
    },
  });
}
