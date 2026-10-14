import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { withUpdatePostLock } from '../../utils/updatePostLock.js';
import { logger } from '../../utils/logger.js';

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

async function removeManagedStickyMessages(channel, client, savedMessageId = null, previousText = null, replacementText = '') {
  const replacementPayload = {
    content: replacementText + STICKY_MARKER,
    allowedMentions: { parse: [] },
  };
  let fallbackMessage = null;

  if (savedMessageId) {
    const previous = await channel.messages.fetch(savedMessageId).catch(() => null);
    if (previous) {
      try {
        await previous.delete();
      } catch (error) {
        // If Discord refuses to delete the old post, update it instead of
        // making the user delete it manually or creating a second sticky.
        try {
          fallbackMessage = await previous.edit(replacementPayload);
          logger.warn('Could not delete the old sticky; updated it in place. Check Manage Messages permission if it must be reposted at the bottom:', error?.message || error);
        } catch (editError) {
          throw new Error(
            'Could not delete or update the existing sticky message. Check TigerBot channel permissions, especially Manage Messages.'
          );
        }
      }
    }
  }

  // Best-effort migration cleanup for marker-based and older unmarked stickies.
  const recent = await channel.messages.fetch({ limit: 100 }).catch((error) => {
    logger.warn('Could not scan sticky history; continuing with saved-message handling:', error?.message || error);
    return null;
  });

  if (recent) {
    for (const candidate of recent.values()) {
      if (candidate.author?.id !== client.user?.id || candidate.id === fallbackMessage?.id) continue;
      const candidateText = String(candidate.content || '');
      const isMarkedSticky = candidateText.endsWith(STICKY_MARKER);
      const isLegacySticky = Boolean(previousText) && candidateText === previousText;
      if (!isMarkedSticky && !isLegacySticky) continue;

      try {
        await candidate.delete();
      } catch (error) {
        if (!fallbackMessage) {
          try {
            fallbackMessage = await candidate.edit(replacementPayload);
            logger.warn('Could not delete a previous sticky copy; updated it in place instead:', error?.message || error);
          } catch (editError) {
            throw new Error(
              'Could not delete or update an older sticky message. Check TigerBot channel permissions, especially Manage Messages.'
            );
          }
        } else {
          logger.warn('Could not remove an additional sticky copy:', error?.message || error);
        }
      }
    }
  }

  return fallbackMessage;
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
      .setMaxLength(1990),
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
    let reusedSticky = false;
    await withUpdatePostLock(channel.id, async () => {
      const existing = await client.db.get(KEY(interaction.guildId), null);
      const channels = existing?.channels && typeof existing.channels === 'object'
        ? { ...existing.channels }
        : {};

      // Migrate the old single-channel storage format without discarding its sticky.
      addLegacyChannel(channels, existing);

      const current = channels[channel.id];
      const existingSticky = await removeManagedStickyMessages(
        channel,
        client,
        current?.messageId || null,
        current?.message || null,
        message,
      );
      reusedSticky = Boolean(existingSticky);
      const stickyMessage = existingSticky || await channel.send({
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
      (reusedSticky
        ? '⚠️ **Sticky message updated in place.** Discord did not allow me to delete the old post, so I updated it instead of creating a duplicate. Give TigerBot **Manage Messages** permission in that channel to restore automatic delete-and-repost positioning.\n\n'
        : '✅ **Sticky message enabled.**\n\n') +
      '**Channel:** ' + channel + '\n' +
      '**Message:** ' + message + '\n\n' +
      'Run `/sticky` again for other channels; each channel keeps its own sticky at the bottom.',
    );
  } catch (error) {
    await interaction.editReply({
      content: '❌ I could not safely replace the sticky message, so I did not post another copy. Check that TigerBot has Manage Messages and Send Messages permissions in that channel.',
    }).catch(() => {});
  }
}

export default { data, execute };
