import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MESSAGE_FILE = path.join(__dirname, 'updatePanelMessage.json');

const UPDATE_BUTTONS = [
  { command: 'spawnerupdate', label: 'Spawners', emoji: '🕷️', style: ButtonStyle.Primary },
  { command: 'diggingupdate', label: 'Digging', emoji: '⛏️', style: ButtonStyle.Secondary },
  { command: 'buildingupdate', label: 'Building', emoji: '🏗️', style: ButtonStyle.Secondary },
  { command: 'advertisementupdate', label: 'Paid Ads', emoji: '💰', style: ButtonStyle.Primary },
  { command: 'giveawayrulesupdate', label: 'Giveaways', emoji: '🎉', style: ButtonStyle.Success },
  { command: 'partnerupdate', label: 'Partners', emoji: '🤝', style: ButtonStyle.Success },
];

function saveMessageId(messageId, channelId) {
  fs.writeFileSync(
    MESSAGE_FILE,
    `${JSON.stringify({ messageId, channelId }, null, 2)}\n`,
    'utf8',
  );
}

async function deletePreviousPanel(channel) {
  const saved = (() => {
    try {
      return JSON.parse(fs.readFileSync(MESSAGE_FILE, 'utf8'));
    } catch {
      return null;
    }
  })();

  if (saved?.messageId && saved.channelId === channel.id) {
    try {
      const message = await channel.messages.fetch(saved.messageId);
      await message.delete();
      return;
    } catch {
      // Continue with migration search.
    }
  }

  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const oldPanel = messages.find((message) =>
      message.author?.bot &&
      message.components?.some((row) =>
        row.components?.some((component) =>
          typeof component.customId === 'string' && component.customId.startsWith('update_panel:'),
        ),
      ),
    );

    if (oldPanel) await oldPanel.delete();
  } catch {
    // Continue so the new panel can still be posted.
  }
}

export function buildUpdatePanel(client) {
  const rows = [];

  for (let i = 0; i < UPDATE_BUTTONS.length; i += 5) {
    const buttons = UPDATE_BUTTONS.slice(i, i + 5).map((item) => {
      const exists = Boolean(client.commands?.get(item.command));
      return new ButtonBuilder()
        .setCustomId(`update_panel:${item.command}`)
        .setLabel(exists ? item.label : `${item.label} (Unavailable)`)
        .setEmoji(item.emoji)
        .setStyle(item.style)
        .setDisabled(!exists);
    });

    rows.push(new ActionRowBuilder().addComponents(buttons));
  }

  return {
    content:
      '# 🛠️ TigerBot Update Panel\n\n' +
      'Use the buttons below to update the corresponding Tiger Market information panel.\n' +
      'Only staff with **Manage Server** can use these update controls.',
    components: rows,
  };
}

export const data = new SlashCommandBuilder()
  .setName('updatepanel')
  .setDescription('Create or update the TigerBot update control panel in this channel.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction, guildConfig, client) {
  if (!interaction.channel || typeof interaction.channel.send !== 'function') {
    await interaction.reply({ content: '❌ This command can only be used in a text channel.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    await deletePreviousPanel(interaction.channel);
    const panel = buildUpdatePanel(client);
    const message = await interaction.channel.send(panel);
    saveMessageId(message.id, interaction.channel.id);

    await interaction.editReply(
      '✅ **Update panel posted.** The previous update panel in this channel was replaced.',
    );
  } catch (error) {
    await interaction.editReply(`❌ **Update panel failed:** ${error?.message || 'Unknown error.'}`);
  }
}

export default { data, execute };
