import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUpdateState, setUpdateState } from '../../utils/updateState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MESSAGE_FILE = path.join(__dirname, 'updatePanelMessage.json');

const UPDATE_BUTTONS = [
  { command: 'spawner-update', label: 'Spawners', emoji: '🕷️', style: ButtonStyle.Primary },
  { command: 'digging-update', label: 'Digging', emoji: '⛏️', style: ButtonStyle.Secondary },
  { command: 'building-update', label: 'Building', emoji: '🏗️', style: ButtonStyle.Secondary },
  { command: 'paid-ad-update', label: 'Paid Ads', emoji: '💰', style: ButtonStyle.Primary },
  { command: 'giveawayrulesupdate', label: 'Giveaways', emoji: '🎉', style: ButtonStyle.Success },
  { command: 'partnerupdate', label: 'Partners', emoji: '🤝', style: ButtonStyle.Success },
];

function saveMessageId(messageId, channelId) {
  try {
    fs.writeFileSync(MESSAGE_FILE, JSON.stringify({ messageId, channelId }, null, 2) + '\n', 'utf8');
  } catch {}
}

async function deletePreviousPanel(channel, client) {
  const state = await getUpdateState(client, channel.guild.id);
  let saved = state.updatePanel;

  if (!saved?.messageId || saved.channelId !== channel.id) {
    try {
      saved = JSON.parse(fs.readFileSync(MESSAGE_FILE, 'utf8'));
    } catch {}
  }

  if (saved?.messageId && saved.channelId === channel.id) {
    try {
      const message = await channel.messages.fetch(saved.messageId);
      await message.delete();
      return;
    } catch {}
  }

  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    const oldPanel = messages.find((message) =>
      message.author?.id === client.user?.id &&
      message.components?.some((row) =>
        row.components?.some((component) =>
          typeof component.customId === 'string' && component.customId.startsWith('update_panel:'),
        ),
      ),
    );
    if (oldPanel) await oldPanel.delete();
  } catch {}
}

export function buildUpdatePanel(client) {
  const rows = [];
  for (let i = 0; i < UPDATE_BUTTONS.length; i += 5) {
    const buttons = UPDATE_BUTTONS.slice(i, i + 5).map((item) => {
      const exists = Boolean(client.commands?.get(item.command));
      return new ButtonBuilder()
        .setCustomId('update_panel:' + item.command)
        .setLabel(item.label)
        .setEmoji(item.emoji)
        .setStyle(item.style)
        .setDisabled(!exists);
    });
    rows.push(new ActionRowBuilder().addComponents(buttons));
  }

  return {
    content: '# 🛠️ TigerBot Update Panel\n\nUse the buttons below to update the corresponding Tiger Market information panel.\nOnly staff with **Manage Server** can use these update controls.',
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
    await deletePreviousPanel(interaction.channel, client);
    const message = await interaction.channel.send(buildUpdatePanel(client));

    // Database is authoritative. The local JSON file is only a compatibility
    // fallback and must never override a newer database value.
    saveMessageId(message.id, interaction.channel.id);
    const saved = await setUpdateState(client, interaction.guildId, {
      updatePanel: { messageId: message.id, channelId: interaction.channel.id },
    });

    if (!saved) {
      throw new Error('The update panel was posted, but its persistent database state could not be saved.');
    }

    await interaction.editReply('✅ **Update panel posted.** The previous update panel in this channel was replaced and the new message ID was saved persistently.');
  } catch (error) {
    await interaction.editReply('❌ **Update panel failed:** ' + (error?.message || 'Unknown error.'));
  }
}

export default { data, execute };
