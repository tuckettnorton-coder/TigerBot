import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- CONFIG ----
const SPAWNER_PRICE_CHANNEL_ID = '1504949441650622575';
const SPAWNER_UPDATE_ROLE_ID = '1509955955063001218';
const DATA_FILE = path.join(__dirname, 'spawnerPrices.json');

const EMOJI_SKELETON = '<:download:1517708652981780682>';
const EMOJI_CREEPER = '<:MinecraftCreeperHead:1517707887068315839>';
const EMOJI_IRONGOLEM = '<:maxresdefault:1517708562489409566>';

const DEFAULT_PRICES = {
  skeleton: { buy3: '9M', buy64: '8.9M', sell3: '7.5M', sell64: '7.6M' },
  creeper: { buy3: '13M', buy64: '12M', sell3: '8M', sell64: '7M' },
  irongolem: { buy3: '18M', buy64: '17M', sell3: '8M', sell64: '9M' },
};

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_PRICES));
}

function loadPrices() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      skeleton: { ...DEFAULT_PRICES.skeleton, ...(parsed.skeleton || {}) },
      creeper: { ...DEFAULT_PRICES.creeper, ...(parsed.creeper || {}) },
      irongolem: { ...DEFAULT_PRICES.irongolem, ...(parsed.irongolem || {}) },
    };
  } catch {
    return cloneDefaults();
  }
}

function savePrices(prices) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(prices, null, 2)}\n`, 'utf8');
}

function pricesToBlock(prices) {
  return [
    `3+ Buy: ${prices.buy3}`,
    `64+ Buy: ${prices.buy64}`,
    `3+ Sell: ${prices.sell3}`,
    `64+ Sell: ${prices.sell64}`,
  ].join('\n');
}

function blockToPrices(block, fallback) {
  const result = { ...fallback };
  const lines = String(block || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^(3\+|64\+)\s*(Buy|Sell)\s*:\s*(.+)$/i);
    if (!match) continue;

    const [, quantity, side, value] = match;
    const key = `${side.toLowerCase()}${quantity.toLowerCase() === '3+' ? '3' : '64'}`;
    if (value.trim()) result[key] = value.trim();
  }

  return result;
}

export function formatPriceMessage(prices) {
  const { skeleton, creeper, irongolem } = prices;

  return (
`${EMOJI_SKELETON} **Skeleton Spawners**
**(You buy from us)**
**3+ Buy:** ${skeleton.buy3}  **64+ Buy:** ${skeleton.buy64}
**(You sell to us)**
**3+ Sell:** ${skeleton.sell3}  **64+ Sell:** ${skeleton.sell64}

${EMOJI_CREEPER} **Creeper Spawners**
**(You buy from us)**
**3+ Buy:** ${creeper.buy3}  **64+ Buy:** ${creeper.buy64}
**(You sell to us)**
**3+ Sell:** ${creeper.sell3}  **64+ Sell:** ${creeper.sell64}

${EMOJI_IRONGOLEM} **Iron Golem Spawners**
**(You buy from us)**
**3+ Buy:** ${irongolem.buy3}  **64+ Buy:** ${irongolem.buy64}
**(You sell to us)**
**3+ Sell:** ${irongolem.sell3}  **64+ Sell:** ${irongolem.sell64}

### __NOTE__- WE DON'T GO FIRST FOR BUYING/SELLING SPAWNERS MAKE A <#${SPAWNER_PRICE_CHANNEL_ID}>
# MINIMUM 3+
**ALL messages** regarding your ticket / spawners will be IN THE TICKET ONLY!! Scammers can SEE your ticket but not the messages inside, **dont get fooled by this**! <@&${SPAWNER_UPDATE_ROLE_ID}> , with the updates to the channel 💵│spawner-prices.`
  );
}

export const data = new SlashCommandBuilder()
  .setName('spawner-update')
  .setDescription('Update spawner buy/sell prices')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const prices = loadPrices();

  const modal = new ModalBuilder()
    .setCustomId('spawner_update_modal')
    .setTitle('Update Spawner Prices');

  const skeletonInput = new TextInputBuilder()
    .setCustomId('skeleton_block')
    .setLabel('Skeleton Spawner Prices')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(pricesToBlock(prices.skeleton))
    .setRequired(true);

  const creeperInput = new TextInputBuilder()
    .setCustomId('creeper_block')
    .setLabel('Creeper Spawner Prices')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(pricesToBlock(prices.creeper))
    .setRequired(true);

  const irongolemInput = new TextInputBuilder()
    .setCustomId('irongolem_block')
    .setLabel('Iron Golem Spawner Prices')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(pricesToBlock(prices.irongolem))
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(skeletonInput),
    new ActionRowBuilder().addComponents(creeperInput),
    new ActionRowBuilder().addComponents(irongolemInput),
  );

  await interaction.showModal(modal);
}

export default { data, execute };

export function parseSubmittedPrices(interaction) {
  const oldPrices = loadPrices();

  return {
    skeleton: blockToPrices(
      interaction.fields.getTextInputValue('skeleton_block'),
      oldPrices.skeleton,
    ),
    creeper: blockToPrices(
      interaction.fields.getTextInputValue('creeper_block'),
      oldPrices.creeper,
    ),
    irongolem: blockToPrices(
      interaction.fields.getTextInputValue('irongolem_block'),
      oldPrices.irongolem,
    ),
  };
}

export function persistPrices(prices) {
  savePrices(prices);
}

export async function postPrices(client, prices) {
  const channel = await client.channels.fetch(SPAWNER_PRICE_CHANNEL_ID);

  if (!channel || typeof channel.send !== 'function') {
    throw new Error(`Spawner price channel ${SPAWNER_PRICE_CHANNEL_ID} is not a sendable channel.`);
  }

  await channel.send({ content: formatPriceMessage(prices) });
}
