import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUpdateState, setUpdateState, getLatestUpdateData } from '../../utils/updateState.js';
import { withUpdatePostLock } from '../../utils/updatePostLock.js';
import { logger } from '../../utils/logger.js';

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

function isSpawnerPriceMessage(message, client) {
  if (message.author?.id !== client.user?.id || !message.content) return false;
  return message.content.includes('**Skeleton Spawners**')
    && message.content.includes('**Creeper Spawners**')
    && message.content.includes('**Iron Golem Spawners**')
    && message.content.includes('MINIMUM 3+');
}

function newestFirst(a, b) {
  try {
    const left = BigInt(a.id);
    const right = BigInt(b.id);
    return right > left ? 1 : right < left ? -1 : 0;
  } catch {
    return (b.createdTimestamp || 0) - (a.createdTimestamp || 0);
  }
}

async function findSpawnerPriceMessages(client, channel, savedIds = []) {
  const messages = new Map();

  // Start from the IDs saved by earlier updates, even if history access is
  // temporarily unavailable.
  for (const messageId of savedIds) {
    if (!messageId) continue;
    try {
      const message = await channel.messages.fetch(messageId);
      if (isSpawnerPriceMessage(message, client)) messages.set(message.id, message);
    } catch {
      // A saved message can have been deleted or become inaccessible.
    }
  }

  // Also find older duplicate posts left by overlapping bot instances.
  try {
    const recent = await channel.messages.fetch({ limit: 50 });
    for (const message of recent.values()) {
      if (isSpawnerPriceMessage(message, client)) messages.set(message.id, message);
    }
  } catch (error) {
    logger.warn('Could not scan recent spawner-price messages:', error?.message || error);
  }

  return [...messages.values()].sort(newestFirst);
}

function parsePostedPrices(content) {
  if (!content) return null;
  const sections = [
    ['skeleton', '**Skeleton Spawners**', '**Creeper Spawners**'],
    ['creeper', '**Creeper Spawners**', '**Iron Golem Spawners**'],
    ['irongolem', '**Iron Golem Spawners**', '### __NOTE__'],
  ];
  const result = {};

  for (const [key, startMarker, endMarker] of sections) {
    const start = content.indexOf(startMarker);
    if (start < 0) return null;
    const end = content.indexOf(endMarker, start + startMarker.length);
    const section = content.slice(start, end < 0 ? undefined : end);
    const buyLine = section.split('\n').find((line) => line.includes('**3+ Buy:**'));
    const sellLine = section.split('\n').find((line) => line.includes('**3+ Sell:**'));
    if (!buyLine || !sellLine) return null;

    const buy = buyLine.split('  ');
    const sell = sellLine.split('  ');
    if (buy.length < 2 || sell.length < 2) return null;

    result[key] = {
      buy3: buy[0].replace('**3+ Buy:**', '').trim(),
      buy64: buy[1].replace('**64+ Buy:**', '').trim(),
      sell3: sell[0].replace('**3+ Sell:**', '').trim(),
      sell64: sell[1].replace('**64+ Sell:**', '').trim(),
    };
  }

  return result;
}

async function postPricesUnlocked(client, channel, prices) {
  const state = await getUpdateState(client, channel.guild.id);
  const savedIds = [
    state.spawnerPriceMessageId,
    loadMessageId(),
  ].filter(Boolean);
  const messageContent = formatPriceMessage(prices);

  // Reuse and edit the newest existing TigerBot price post instead of always
  // deleting then sending a replacement. Editing cannot create another post.
  const existingMessages = await findSpawnerPriceMessages(client, channel, savedIds);
  let postedMessage = existingMessages[0] || null;

  if (postedMessage) {
    await postedMessage.edit({ content: messageContent });
  } else {
    postedMessage = await channel.send({ content: messageContent });
  }

  // If two separate bot processes both receive the same submission, they cannot
  // share an in-memory lock. A short delayed reconciliation ensures only the
  // newest price post remains after concurrent sends have had time to arrive.
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const refreshedMessages = await findSpawnerPriceMessages(client, channel, [postedMessage.id]);
  const canonicalMessage = refreshedMessages[0] || postedMessage;

  for (const duplicate of refreshedMessages.slice(1)) {
    try {
      await duplicate.delete();
    } catch (error) {
      logger.warn(`Could not remove duplicate spawner-price message ${duplicate.id}:`, error?.message || error);
    }
  }

  const canonicalPrices = parsePostedPrices(canonicalMessage.content) || prices;
  saveMessageId(canonicalMessage.id);
  await setUpdateState(client, channel.guild.id, {
    spawnerPriceMessageId: canonicalMessage.id,
    spawnerPriceChannelId: channel.id,
    spawnerPrices: canonicalPrices,
    spawnerPriceMessage: canonicalMessage.content || messageContent,
  });
}

export async function postPrices(client, prices) {
  return withUpdatePostLock(SPAWNER_PRICE_CHANNEL_ID, async () => {
    const channel = await client.channels.fetch(SPAWNER_PRICE_CHANNEL_ID).catch(() => null);
    if (!channel || typeof channel.send !== 'function') {
      throw new Error(`Spawner price channel ${SPAWNER_PRICE_CHANNEL_ID} is not a sendable channel.`);
    }
    await postPricesUnlocked(client, channel, prices);
  });
}
