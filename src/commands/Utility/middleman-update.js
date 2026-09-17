import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MIDDLEMAN_UPDATE_CHANNEL_ID = '1519838464374476991';
export const MIDDLEMAN_TICKET_CHANNEL_ID = '1504949441650622575';
const DATA_FILE = path.join(__dirname, 'middlemanMessage.json');
const MESSAGE_FILE = path.join(__dirname, 'middlemanMessageId.json');

export const DEFAULT_MESSAGE = `<@&1528495941328441456>\n\n# 🤝 OFFICIAL MIDDLEMAN SERVICE\n\nWelcome to the Official Middleman Service! Our trusted Middlemen help keep your trades safe and secure.\n\n━━━━━━━━━━━━━━━━━━\n\n## 📋 HOW IT WORKS\n\n• To buy or sell any spawner or use a Middleman for another service, you must create a ticket.\n• Clearly state the items, amount, price, and full agreement in the ticket.\n• Both parties provide the agreed payment or items to the Middleman.\n• The Middleman holds everything securely until both sides complete their part of the deal.\n• Once everything is confirmed, the Middleman completes the transaction.\n\n━━━━━━━━━━━━━━━━━━\n\n## 💰 MIDDLEMAN FEES\n\n### Spawner Trades\n\n• **50Kk fee per spawner sold.**\n• **25Kk fee per spawner** when selling more than **64 spawners**.\n• The buyer, seller, or both parties can decide who pays the Middleman fee.\n\n### Builds & Other Services\n\n• For builds or anything else requiring a Middleman, we charge **10% of the total value being exchanged**.\n• Who pays the fee is entirely up to you and the other person involved in the deal.\n\n━━━━━━━━━━━━━━━━━━\n\n## 🛡️ WHY USE A MIDDLEMAN?\n\n• Helps prevent scams.\n• Keeps payments and items secure.\n• Provides a trusted third party during transactions.\n• Helps ensure both sides receive exactly what was agreed.\n\n━━━━━━━━━━━━━━━━━━\n\n## ⚠️ IMPORTANT RULES\n\n• Only use official Middlemen from this server.\n• All official Middlemen are **Buyer/Seller+** and trusted by the server.\n• Do **NOT** trade without creating a ticket — unverified trades are not protected.\n• Make sure all agreements are clearly stated in the ticket.\n• Any attempt to scam may result in punishment and removal from the service.\n\n**No Middleman = Trade at your own risk.**\n\n━━━━━━━━━━━━━━━━━━\n\n## 🎫 READY TO START?\n\nHead over to <#1504949441650622575> and open a ticket to begin your safe Middleman trade today.`;

export function loadMiddlemanMessage() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return parsed.message || DEFAULT_MESSAGE;
  } catch {
    return DEFAULT_MESSAGE;
  }
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
  .setDescription('Update the Official Middleman Service message')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const { buildMiddlemanUpdateModal } = await import('../../interactions/modals/middleman_update_modal.js');
  await interaction.showModal(buildMiddlemanUpdateModal(loadMiddlemanMessage()));
}

export default { data, execute };
