import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUpdateState, setUpdateState } from '../../utils/updateState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DIGGING_PRICE_CHANNEL_ID = '1513625068239065158';
export const DIGGING_BUY_ROLE_ID = '1528495941328441456';
export const DIGGING_TICKET_CHANNEL_ID = '1504949441650622575';
const DATA_FILE = path.join(__dirname, 'diggingPrices.json');
const MESSAGE_FILE = path.join(__dirname, 'diggingPriceMessage.json');

const DEFAULT_PRICES = {
  perBlock: '$1000',
  goodCoords: '20M',
  customRegion: '10M',
};

const DEFAULT_NOTES = [
  'Any payments over **5M** must be paid to `TigerFX_` he will pay the builder when it’s done',
  'If you do not supply a location or buy good coords / specific biome, low activity, and good coords the builder can build anywhere',
  'There is a 10% tax on payments that go through me',
].join('\n');

const DEFAULT_REFUND = [
  'If you have paid and the project **has not been started**, you may request a refund. However, a **10% fee** will be deducted from your refund.',
  'Once the project has been started, no refunds will be issued.',
].join('\n');

const DEFAULT_TICKET = 'Make a `Digging Service` <#1504949441650622575>  To Buy <@&1528495941328441456>';

function cloneDefaults() {
  return {
    prices: { ...DEFAULT_PRICES },
    notes: DEFAULT_NOTES,
    refundPolicy: DEFAULT_REFUND,
    ticket: DEFAULT_TICKET,
  };
}

export function loadDiggingPrices() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const defaults = cloneDefaults();
    return {
      prices: { ...defaults.prices, ...(parsed.prices || {}) },
      notes: parsed.notes || defaults.notes,
      refundPolicy: parsed.refundPolicy || defaults.refundPolicy,
      ticket: parsed.ticket || defaults.ticket,
    };
  } catch {
    return cloneDefaults();
  }
}

function saveDiggingPrices(data) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function loadMessageId() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MESSAGE_FILE, 'utf8'));
    return parsed.messageId || null;
  } catch {
    return null;
  }
}

function saveMessageId(messageId) {
  fs.writeFileSync(MESSAGE_FILE, `${JSON.stringify({ messageId }, null, 2)}\n`, 'utf8');
}

export function formatDiggingPriceMessage(data) {
  const { prices, notes, refundPolicy, ticket = DEFAULT_TICKET } = data;
  return [
    '# Digging Prices',
    `- ${prices.perBlock} Per block`,
    `- ${prices.goodCoords} For good coords`,
    `- ${prices.customRegion} For custom region`,
    '',
    '# Additional Notes',
    notes,
    '',
    '# 💰 Refund Policy',
    refundPolicy,
    '',
    `### ${ticket}`,
  ].join('\n');
}

export const data = new SlashCommandBuilder()
  .setName('digging-update')
  .setDescription('Update the digging service prices and information')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const { buildDiggingPriceModal } = await import('../../interactions/modals/digging_update_modal.js');
  await interaction.showModal(buildDiggingPriceModal(loadDiggingPrices()));
}

export default { data, execute };

export function persistDiggingPrices(data) {
  saveDiggingPrices(data);
}

export async function postDiggingPrices(client, data) {
  const channel = await client.channels.fetch(DIGGING_PRICE_CHANNEL_ID).catch(() => null);
  if (!channel || typeof channel.send !== 'function') {
    throw new Error(`Digging price channel ${DIGGING_PRICE_CHANNEL_ID} is not a sendable channel.`);
  }

  // Delete the previous message sent by /digging-update, then send the replacement.
  const state = await getUpdateState(client, channel.guild.id);
  const previousMessageId = state.diggingPriceMessageId || loadMessageId();
  if (previousMessageId) {
    try {
      const previousMessage = await channel.messages.fetch(previousMessageId);
      if (previousMessage) await previousMessage.delete();
    } catch {
      // The old message may already have been deleted. Continue and create the new one.
    }
  }

  try {
    const newMessage = await channel.send({ content: formatDiggingPriceMessage(data) });
    saveMessageId(newMessage.id);
    await setUpdateState(client, channel.guild.id, { diggingPriceMessageId: newMessage.id, diggingPriceChannelId: channel.id });
  } catch (error) {
    const apiMessage = error?.rawError?.message || error?.message || 'Unknown Discord API error.';
    throw new Error(`Could not post the digging prices: ${apiMessage}`);
  }
}
