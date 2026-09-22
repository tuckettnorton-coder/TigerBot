import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUpdateState, setUpdateState, getLatestUpdateData } from '../../utils/updateState.js';

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

function loadMessageId() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MESSAGE_FILE, 'utf8'));
    return parsed.messageId || null;
  } catch { return null; }
}

function saveMessageId(messageId) {
  fs.writeFileSync(MESSAGE_FILE, `${JSON.stringify({ messageId }, null, 2)}\n`, 'utf8');
}

export function formatPriceMessage(prices) {
  const { skeleton, creeper, irongolem } = prices;
  return `${EMOJI_SKELETON} **Skeleton Spawners**
**(You buy from us)**
**3+ Buy:** ${skeleton.buy3}  **64+ Buy:** ${skeleton.buy64}
**(You sell to us)**
**3+ Sell:** ${skeleton.sell3}  **64+ Sell:** ${skeleton.sell64}

${EMOJI_CREEPER} **Creeper Spawners**
**(You buy from us)**
**3+ Buy:** ${creeper.buy3}  **64+ Buy:** ${creeper.buy64}
**(You sell to us)**
**3+ Sell:** ${creeper.sell3}  **64+ Sell:** ${creeper.sell64}

${EMOJI_IRONGOLEM} **Iron Golem Spawners**
**(You buy from us)**
**3+ Buy:** ${irongolem.buy3}  **64+ Buy:** ${irongolem.buy64}
**(You sell to us)**
**3+ Sell:** ${irongolem.sell3}  **64+ Sell:** ${irongolem.sell64}

### __NOTE__- WE DON'T GO FIRST FOR BUYING/SELLING SPAWNERS MAKE A <#${TICKET_CHANNEL_ID}> 
# MINIMUM 3+
**ALL messages** regarding your ticket / spawners will be IN THE TICKET ONLY!! Scammers can SEE your ticket but not the messages inside, **dont get fooled by this**! <@&${SPAWNER_UPDATE_ROLE_ID}>`;
}

export const data = new SlashCommandBuilder()
  .setName('spawner-update')
  .setDescription('Update all 12 spawner prices')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction, guildConfig, client) {
  const { buildSpawnerPriceModal } = await import('../../interactions/modals/spawner_update_modal.js');
  const saved = await getLatestUpdateData(client, interaction.guildId, 'spawnerPrices', null);
  await interaction.showModal(buildSpawnerPriceModal(saved || loadPrices()));
}

export default { data, execute };

export function persistPrices(prices) { savePrices(prices); }

export async function postPrices(client, prices) {
  const channel = await client.channels.fetch(SPAWNER_PRICE_CHANNEL_ID).catch(() => null);
  if (!channel || typeof channel.send !== 'function') {
    throw new Error(`Spawner price channel ${SPAWNER_PRICE_CHANNEL_ID} is not a sendable channel.`);
  }

  const state = await getUpdateState(client, channel.guild.id);
  const previousMessageId = state.spawnerPriceMessageId || loadMessageId();
  if (previousMessageId) {
    try {
      const previousMessage = await channel.messages.fetch(previousMessageId);
      if (previousMessage) await previousMessage.delete();
    } catch {}
  }

  try {
    const newMessage = await channel.send({ content: formatPriceMessage(prices) });
    saveMessageId(newMessage.id);
    await setUpdateState(client, channel.guild.id, { spawnerPriceMessageId: newMessage.id, spawnerPriceChannelId: channel.id, spawnerPrices: prices, spawnerPriceMessage: formatPriceMessage(prices) });
  } catch (error) {
    const apiMessage = error?.rawError?.message || error?.message || 'Unknown Discord API error.';
    throw new Error(`Could not post the 12 spawner prices: ${apiMessage}`);
  }
}
