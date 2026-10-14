import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { withUpdatePostLock } from '../../utils/updatePostLock.js';

const KEY = (guildId) => 'guild:' + guildId + ':repeat-message';
const STICKY_MARKER = '\u2063\u200B\u2063';

function addLegacyChannel(channels, existing) {
  if (existing?.channelId && !channels[existing.channelId]) {
    channels[existing.channelId] = {
      message: existing.message,
      messageId: existing.messageId || null,
      updatedAt: existing.updatedAt || new Date().toISOString(),
      enabled: existing.enabled !== false,
    };
  }
}

async function removeManagedStickyMessages(channel, client, savedMessageId = null) {
  if (savedMessageId) {
    const previous = await channel.messages.fetch(savedMessageId).catch(() => null);
    if (previous) {
      // Never post a replacement if the previous sticky could not be removed.
      await previous.delete();
    }
  }

  const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!recent) return;

  for (const candidate of recent.values()) {
    if (candidate.author?.id !== client.user?.id) continue;
    if (!String(candidate.content || '').endsWith(STICKY_MARKER)) continue;
    await candidate.delete();
  }
}

export const data = new SlashCommandBuilder()
  .setName('sticky')
  .setDescription('Set a sticky message that always stays at the bottom of a channel.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('The channel where the sticky message should stay at the bottom')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName('message')
      .setDescription('The message to keep at the bottom')
      .setRequired(true)
      .setMaxLength(2000),
  );

export async function execute(interaction, guildConfig, client) {
  const channel = interaction.options.getChannel('channel', true);
  const message = interaction.options.getString('message', true);

  if (!interaction.guildId || !client?.db) {
    await interaction.reply({ content: '❌ The database is not available.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    await withUpdatePostLock(channel.id, async () => {
      const existing = await client.db.get(KEY(interaction.guildId), null);
      const channels = existing?.channels && typeof existing.channels === 'object'
        ? { ...existing.channels }
        : {};

      // Migrate the old single-channel storage format without discarding its sticky.
      addLegacyChannel(channels, existing);

      const current = channels[channel.id];
      await removeManagedStickyMessages(channel, client, current?.messageId || null);

      const stickyMessage = await channel.send({
        content: message + STICKY_MARKER,
        allowedMentions: { parse: [] },
      });

      channels[channel.id] = {
        message,
        messageId: stickyMessage.id,
        updatedAt: new Date().toISOString(),
        enabled: true,
      };

      try {
        await client.db.set(KEY(interaction.guildId), {
          channels,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        await stickyMessage.delete().catch(() => {});
        throw error;
      }
    });

    await interaction.editReply(
      '✅ **Sticky message enabled.**\n\n' +
      '**Channel:** ' + channel + '\n' +
      '**Message:** ' + message + '\n\n' +
      'This channel is now part of your sticky system. Run `/sticky` again for other channels; each channel keeps its own sticky at the bottom.',
    );
  } catch (error) {
    await interaction.editReply({
      content: '❌ I could not safely replace the sticky message, so I did not post another copy. Check that TigerBot has Manage Messages and Send Messages permissions in that channel.',
    }).catch(() => {});
  }
}

export default { data, execute };
