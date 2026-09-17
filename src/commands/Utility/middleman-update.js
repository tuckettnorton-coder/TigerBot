import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

function loadMessageId() {
  try {
    return JSON.parse(fs.readFileSync(MESSAGE_FILE, 'utf8')).messageId || null;
  } catch {
    return null;
  }
}

function saveMessageId(messageId) {
  fs.writeFileSync(MESSAGE_FILE, `${JSON.stringify({ messageId }, null, 2)}\n`, 'utf8');
}

export function persistMiddlemanMessage(message) {
  saveMiddlemanMessage(message);
}

export async function postMiddlemanMessage(client, message) {
  const channel = await client.channels.fetch(MIDDLEMAN_UPDATE_CHANNEL_ID).catch(() => null);
  if (!channel || typeof channel.send !== 'function') {
    throw new Error(`Middleman update channel ${MIDDLEMAN_UPDATE_CHANNEL_ID} is not a sendable channel.`);
  }

  const previousMessageId = loadMessageId();
  if (previousMessageId) {
    try {
      const previousMessage = await channel.messages.fetch(previousMessageId);
      if (previousMessage) await previousMessage.delete();
    } catch {
      // Previous message may already be deleted. Continue with the replacement.
    }
  }

  const newMessage = await channel.send({ content: message });
  saveMessageId(newMessage.id);
  return newMessage;
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
