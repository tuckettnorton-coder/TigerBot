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

function cloneDefaults() { return JSON.parse(JSON.stringify(DEFAULT_PRICES)); }

export function loadPrices() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {
      skeleton: { ...DEFAULT_PRICES.skeleton, ...(parsed.skeleton || {}) },
      creeper: { ...DEFAULT_PRICES.creeper, ...(parsed.creeper || {}) },
      irongolem: { ...DEFAULT_PRICES.irongolem, ...(parsed.irongolem || {}) },
    };
  } catch { return cloneDefaults(); }
}

function savePrices(prices) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(prices, null, 2)}\n`, 'utf8');
}

function addPriceInput(modal, customId, label, value) {
  const input = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setValue(String(value ?? ''))
    .setRequired(true)
    .setMaxLength(100);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
}

export function buildSpawnerModal(spawner, prices) {
  const names = { skeleton: 'Skeleton', creeper: 'Creeper', irongolem: 'Iron Golem' };
  const modal = new ModalBuilder()
    // The interaction loader splits custom IDs at ':' and passes the second
    // part to the registered spawner_update_modal handler.
    .setCustomId(`spawner_update_modal:${spawner}`)
    .setTitle(`${names[spawner]} Spawner Prices`);

  const current = prices[spawner];
  addPriceInput(modal, `${spawner}_buy3`, '3+ Buy Price', current.buy3);
  addPriceInput(modal, `${spawner}_buy64`, '64+ Buy Price', current.buy64);
  addPriceInput(modal, `${spawner}_sell3`, '3+ Sell Price', current.sell3);
  addPriceInput(modal, `${spawner}_sell64`, '64+ Sell Price', current.sell64);
  return modal;
}

export function formatPriceMessage(prices) {
  const { skeleton, creeper, irongolem } = prices;
  return (`${EMOJI_SKELETON} **Skeleton Spawners**
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
**ALL messages** regarding your ticket / spawners will be IN THE TICKET ONLY!! Scammers can SEE your ticket but not the messages inside, **dont get fooled by this**! <@&${SPAWNER_UPDATE_ROLE_ID}> , with the updates to the channel 💵│spawner-prices.`);
}

export const data = new SlashCommandBuilder()
  .setName('spawner-update')
  .setDescription('Update spawner buy/sell prices')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  await interaction.showModal(buildSpawnerModal('skeleton', loadPrices()));
}

export default { data, execute };

export function parseSpawnerSubmission(interaction, spawner, fallback) {
  return {
    buy3: interaction.fields.getTextInputValue(`${spawner}_buy3`).trim() || fallback.buy3,
    buy64: interaction.fields.getTextInputValue(`${spawner}_buy64`).trim() || fallback.buy64,
    sell3: interaction.fields.getTextInputValue(`${spawner}_sell3`).trim() || fallback.sell3,
    sell64: interaction.fields.getTextInputValue(`${spawner}_sell64`).trim() || fallback.sell64,
  };
}

export function persistPrices(prices) { savePrices(prices); }

export async function postPrices(client, prices) {
  const channel = await client.channels.fetch(SPAWNER_PRICE_CHANNEL_ID);
  if (!channel || typeof channel.send !== 'function') {
    throw new Error(`Spawner price channel ${SPAWNER_PRICE_CHANNEL_ID} is not a sendable channel.`);
  }
  await channel.send({ content: formatPriceMessage(prices) });
}
