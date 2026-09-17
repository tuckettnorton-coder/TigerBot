import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
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

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_PRICES));
}

export function loadPrices() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
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

export function formatPriceMessage(prices) {
  const { skeleton, creeper, irongolem } = prices;
  const embed = new EmbedBuilder()
    .setTitle('Spawner Prices')
    .setColor(0x2b2d31)
    .addFields(
      {
        name: `${EMOJI_SKELETON} Skeleton Spawners`,
        inline: true,
        value: [
          '**3+ Buy:** ' + skeleton.buy3,
          '**64+ Buy:** ' + skeleton.buy64,
          '**3+ Sell:** ' + skeleton.sell3,
          '**64+ Sell:** ' + skeleton.sell64,
        ].join('\n'),
      },
      {
        name: `${EMOJI_CREEPER} Creeper Spawners`,
        inline: true,
        value: [
          '**3+ Buy:** ' + creeper.buy3,
          '**64+ Buy:** ' + creeper.buy64,
          '**3+ Sell:** ' + creeper.sell3,
          '**64+ Sell:** ' + creeper.sell64,
        ].join('\n'),
      },
      {
        name: `${EMOJI_IRONGOLEM} Iron Golem Spawners`,
        inline: true,
        value: [
          '**3+ Buy:** ' + irongolem.buy3,
          '**64+ Buy:** ' + irongolem.buy64,
          '**3+ Sell:** ' + irongolem.sell3,
          '**64+ Sell:** ' + irongolem.sell64,
        ].join('\n'),
      },
    )
    .setDescription(
      `### __NOTE__\nWE DON'T GO FIRST FOR BUYING/SELLING SPAWNERS. MAKE A <#${SPAWNER_PRICE_CHANNEL_ID}>\n# MINIMUM 3+\n**ALL messages** regarding your ticket / spawners will be IN THE TICKET ONLY!! Scammers can SEE your ticket but not the messages inside, **dont get fooled by this**! <@&${SPAWNER_UPDATE_ROLE_ID}> with the updates to the channel 💵│spawner-prices.`
    );

  return { embeds: [embed] };
}

export const data = new SlashCommandBuilder()
  .setName('spawner-update')
  .setDescription('Update all 12 spawner prices')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const { startDraft } = await import('./spawnerEditor.js');
  const { buildSpawnerPriceModal } = await import('../../interactions/modals/spawner_update_modal.js');

  startDraft(interaction);
  await interaction.showModal(buildSpawnerPriceModal(1, loadPrices()));
}

export default { data, execute };

export function persistPrices(prices) {
  savePrices(prices);
}

export async function postPrices(client, prices) {
  const channel = await client.channels.fetch(SPAWNER_PRICE_CHANNEL_ID).catch(() => null);
  if (!channel || typeof channel.send !== 'function') {
    throw new Error(`Spawner price channel ${SPAWNER_PRICE_CHANNEL_ID} is not a sendable channel.`);
  }

  try {
    await channel.send(formatPriceMessage(prices));
  } catch (error) {
    const apiMessage = error?.rawError?.message || error?.message || 'Unknown Discord API error.';
    throw new Error(`Could not post the 12 spawner prices: ${apiMessage}`);
  }
}
