import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUpdateState, setUpdateState } from '../../utils/updateState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const GIVEAWAY_RULES_CHANNEL_ID = '1513947221815590932';
export const CLAIM_ROLE_ID = '1513948994898759911';
export const DAILY_CHANNEL_ID = '1505767690889859072';
export const BIG_CHANNEL_ID = '1505768396221054976';
export const QUICK_CHANNEL_ID = '1505768034718060644';

const DATA_FILE = path.join(__dirname, 'giveawayRules.json');
const MESSAGE_FILE = path.join(__dirname, 'giveawayRulesMessage.json');

const DEFAULT_DATA = {
  dailyTime: '24 Hours',
  bigTime: '6 Hours',
  quickTime: '1 Hour',
  payoutTime: '3–5 days',
  fakeClaimAction: `Fake or edited claim screenshots will result in you receiving <@&${CLAIM_ROLE_ID}>.`,
  pingRule: 'Pinging anyone in your claim ticket = **NO PAY.**',
  sosRule: 'For SOS giveaways, if not everyone claims, **nobody wins.**',
};

export function loadGiveawayRules() {
  try {
    return { ...DEFAULT_DATA, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

function saveGiveawayRules(data) {
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

export function formatGiveawayRulesMessage(data) {
  return `# 🎉 Giveaway Information

## ⏰ Giveaway Claim Times

**Daily Giveaways — ${data.dailyTime}**
<#${DAILY_CHANNEL_ID}>

**Big Giveaways — ${data.bigTime}**
<#${BIG_CHANNEL_ID}>

**Quick Drops — ${data.quickTime}**
<#${QUICK_CHANNEL_ID}>

Claim times may vary depending on the giveaway.

## 📥 How to Claim

• Open a ticket and send a screenshot showing you were pinged in the giveaway ending message.

## 📜 Rules

${data.fakeClaimAction}

${data.pingRule}

Giveaway prizes are usually paid out within **${data.payoutTime}**, but may take longer.

${data.sosRule}`;
}

export const data = new SlashCommandBuilder()
  .setName('giveawayrulesupdate')
  .setDescription('Edit and repost the giveaway rules information')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const { buildGiveawayRulesModal } = await import('../../interactions/modals/giveaway_rules_update_modal.js');
  await interaction.showModal(buildGiveawayRulesModal(loadGiveawayRules()));
}

export default { data, execute };

export function persistGiveawayRules(data) {
  saveGiveawayRules(data);
}

async function deletePreviousRulesMessage(channel, client) {
  const state = await getUpdateState(client, channel.guild.id);
  const previousMessageId = state.giveawayRulesMessageId || loadMessageId();

  if (previousMessageId) {
    try {
      const previousMessage = await channel.messages.fetch(previousMessageId);
      if (previousMessage) await previousMessage.delete();
      return;
    } catch {
      // Fall through to the migration search below.
    }
  }

  // Migration fallback: if the old version was used before persistent message
  // tracking existed, find its most recent rules message and remove it.
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const oldMessage = messages.find((message) =>
      message.author?.id === client.user?.id &&
      typeof message.content === 'string' &&
      message.content.startsWith('# 🎉 Giveaway Information')
    );

    if (oldMessage) await oldMessage.delete();
  } catch {
    // If the old message cannot be found/deleted, continue so the new one posts.
  }
}

export async function postGiveawayRules(client, data) {
  const channel = await client.channels.fetch(GIVEAWAY_RULES_CHANNEL_ID).catch(() => null);
  if (!channel || typeof channel.send !== 'function') {
    throw new Error(`Giveaway rules channel ${GIVEAWAY_RULES_CHANNEL_ID} is not a sendable channel.`);
  }

  await deletePreviousRulesMessage(channel, client);

  try {
    const newMessage = await channel.send({ content: formatGiveawayRulesMessage(data) });
    saveMessageId(newMessage.id);
    await setUpdateState(client, channel.guild.id, { giveawayRulesMessageId: newMessage.id, giveawayRulesChannelId: channel.id, giveawayRules: data, giveawayRulesMessage: formatGiveawayRulesMessage(data) });
  } catch (error) {
    const apiMessage = error?.rawError?.message || error?.message || 'Unknown Discord API error.';
    throw new Error(`Could not post the giveaway rules: ${apiMessage}`);
  }
}
