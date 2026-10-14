import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUpdateState, setUpdateState } from '../../utils/updateState.js';
import { upsertUpdateMessageParts, getUpdateMessagePartMarker } from '../../utils/updateMessage.js';
import { buildMiddlemanServiceMessage, loadMiddlemanFees } from '../../utils/middlemanPricing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MIDDLEMAN_UPDATE_CHANNEL_ID = '1519838464374476991';
export const MIDDLEMAN_TICKET_CHANNEL_ID = '1504949441650622575';
const DATA_FILE = path.join(__dirname, 'middlemanMessage.json');
const MESSAGE_FILE = path.join(__dirname, 'middlemanMessageId.json');

export function loadMiddlemanMessage() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (parsed.message) return parsed.message;
  } catch {
    // Fall back to the generated message below.
  }
  return buildMiddlemanServiceMessage(loadMiddlemanFees());
}

function saveMiddlemanMessage(message) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify({ message }, null, 2)}\n`, 'utf8');
}

function loadMessageIds() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MESSAGE_FILE, 'utf8'));
    if (Array.isArray(parsed.messageIds)) return parsed.messageIds.filter(Boolean);
    if (parsed.messageId) return [parsed.messageId];
  } catch {
    // No previous message has been saved yet.
  }
  return [];
}

function saveMessageIds(messageIds) {
  fs.writeFileSync(MESSAGE_FILE, `${JSON.stringify({ messageIds }, null, 2)}\n`, 'utf8');
}

export function persistMiddlemanMessage(message) {
  saveMiddlemanMessage(message);
}

function splitDiscordMessage(content, maxLength = 2000) {
  const text = String(content ?? '');
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf('\n', maxLength);
    if (splitAt < 500) splitAt = remaining.lastIndexOf(' ', maxLength);
    if (splitAt < 1) splitAt = maxLength;
    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function postMiddlemanMessage(client, message) {
  const channel = await client.channels.fetch(MIDDLEMAN_UPDATE_CHANNEL_ID).catch(() => null);
  if (!channel || typeof channel.send !== 'function') {
    throw new Error(`Middleman update channel ${MIDDLEMAN_UPDATE_CHANNEL_ID} is not a sendable channel.`);
  }

  const state = await getUpdateState(client, channel.guild.id);
  const previousMessageIds = [...new Set([
    ...(Array.isArray(state.middlemanPriceMessageIds) ? state.middlemanPriceMessageIds : []),
    ...loadMessageIds(),
  ].filter(Boolean))];
  const chunks = splitDiscordMessage(message, 1900);

  await upsertUpdateMessageParts({
    client,
    channel,
    contents: chunks,
    matchesPart: (candidate) => {
      const text = candidate.content || '';
      for (let index = 0; index < chunks.length; index += 1) {
        if (text.endsWith(getUpdateMessagePartMarker(index))) return index;
      }
      // Recognize legacy first-part posts made before invisible markers existed.
      if (text.includes('# 🤝 OFFICIAL MIDDLEMAN SERVICE')) return 0;
      return -1;
    },
    previousMessageIds,
    label: 'middleman fees',
    onSaved: async (messages) => {
      const messageIds = messages.map((savedMessage) => savedMessage.id);
      saveMessageIds(messageIds);
      await setUpdateState(client, channel.guild.id, {
        middlemanPriceMessageIds: messageIds,
        middlemanPriceChannelId: channel.id,
        middlemanFees: loadMiddlemanFees(),
        middlemanPriceMessage: message,
      });
    },
  });
  return true;
}

export const data = new SlashCommandBuilder()
  .setName('middleman-update')
  .setDescription('Update Middleman fees and repost the Official Middleman Service')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const { buildMiddlemanUpdateModal } = await import('../../interactions/modals/middleman_update_modal.js');
  await interaction.showModal(buildMiddlemanUpdateModal(loadMiddlemanFees()));
}

export default { data, execute };
