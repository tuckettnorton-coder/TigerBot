import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUpdateState, setUpdateState } from '../../utils/updateState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PARTNER_RULES_CHANNEL_ID = '1513629563337441321';
const DATA_FILE = path.join(__dirname, 'partnerRules.json');
const MESSAGE_FILE = path.join(__dirname, 'partnerRulesMessage.json');

const DEFAULT_DATA = {
  tier1: '100–199',
  tier2: '200–399',
  tier3: '400–699',
  tier4: '700–2,499',
  tier5: '2,500–3,999',
  tier6: '4,000+',
};

export function loadPartnerRules() {
  try {
    return { ...DEFAULT_DATA, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

export function persistPartnerRules(data) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
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

export function formatPartnerRulesMessage(data) {
  return `# 🤝 Partner Requirements
━━━━━━━━━━━━━━━━━━
## Partnership Tiers
━━━━━━━━━━━━━━━━━━
• **${data.tier1} Members**
↳ You: Member Ping
↳ Us: No Ping
• **${data.tier2} Members**
↳ You: Member Ping
↳ Us: Partner Ping
• **${data.tier3} Members**
↳ You: Partner Ping
↳ Us: Partner Ping
• **${data.tier4} Members**
↳ You: Partner Ping
↳ Us: Partner Ping
• **${data.tier5} Members**
↳ You: No Ping
↳ Us: Partner Ping
• **${data.tier6} Members**
↳ You: No Ping
↳ Us: Partner Ping
━━━━━━━━━━━━━━━━━━
## 📋 Requirements
━━━━━━━━━━━━━━━━━━
• Your advertisement must be posted by itself.
• The required ping must be in the same message as your advertisement.
• Do not combine your advertisement with any other server advertisements.
• Do not edit your advertisement after posting.
↳ Edited advertisements will not receive our partnership ping.
━━━━━━━━━━━━━━━━━━
## 📜 Rules
━━━━━━━━━━━━━━━━━━
• We only partner with DonutSMP-related servers.
• We do not partner with IRL trading servers.
• You always go first.
• Do not ping us until we agree to partner.
• We never use @ everyone or @ Member Ping and @ here.
• We must receive the required ping or the partnership will be denied.
• Blacklisted servers cannot partner.
• Appeals: <#1504949441650622575>
• To partner, open a ticket:
<#1504949441650622575>
━━━━━━━━━━━━━━━━━━
## ⏰ Cooldown
━━━━━━━━━━━━━━━━━━
• You may partner again every 3 days.`;
}

async function deletePreviousPartnerMessage(channel, client) {
  const state = await getUpdateState(client, channel.guild.id);
  const previousMessageId = state.partnerRulesMessageId || loadMessageId();

  if (previousMessageId) {
    try {
      const previousMessage = await channel.messages.fetch(previousMessageId);
      if (previousMessage) await previousMessage.delete();
      return;
    } catch {
      // Fall through to the migration search below.
    }
  }

  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const oldMessage = messages.find((message) =>
      message.author?.id === client.user?.id &&
      typeof message.content === 'string' &&
      message.content.startsWith('# 🤝 Partner Requirements')
    );

    if (oldMessage) await oldMessage.delete();
  } catch {
    // Continue so the new message can still be posted.
  }
}

export async function postPartnerRules(client, data) {
  const channel = await client.channels.fetch(PARTNER_RULES_CHANNEL_ID).catch(() => null);
  if (!channel || typeof channel.send !== 'function') {
    throw new Error(`Partner rules channel ${PARTNER_RULES_CHANNEL_ID} is not a sendable channel.`);
  }

  await deletePreviousPartnerMessage(channel, client);

  try {
    const newMessage = await channel.send({ content: formatPartnerRulesMessage(data) });
    saveMessageId(newMessage.id);
    await setUpdateState(client, channel.guild.id, { partnerRulesMessageId: newMessage.id, partnerRulesChannelId: channel.id, partnerRules: data, partnerRulesMessage: formatPartnerRulesMessage(data) });
  } catch (error) {
    const apiMessage = error?.rawError?.message || error?.message || 'Unknown Discord API error.';
    throw new Error(`Could not post the partner rules: ${apiMessage}`);
  }
}

export const data = new SlashCommandBuilder()
  .setName('partnerupdate')
  .setDescription('Edit and repost the partner requirements')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const { buildPartnerRulesModal } = await import('../../interactions/modals/partner_rules_update_modal.js');
  await interaction.showModal(buildPartnerRulesModal(loadPartnerRules()));
}

export default { data, execute };
