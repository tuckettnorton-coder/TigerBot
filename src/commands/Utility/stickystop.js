import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { withUpdatePostLock } from '../../utils/updatePostLock.js';
import { logger } from '../../utils/logger.js';

const KEY = (guildId) => 'guild:' + guildId + ':repeat-message';
const STICKY_MARKER = '\u2063\u200B\u2063';

export default {
  data: new SlashCommandBuilder()
    .setName('stickystop')
    .setDescription('Stop and remove the sticky message from a channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel whose sticky message should be stopped')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    ),

  async execute(interaction, _guildConfig, client) {
    const channel = interaction.options.getChannel('channel', true);
    if (!interaction.guildId || !client?.db) {
      await interaction.reply({ content: '❌ The database is not available.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      let stopped = false;
      await withUpdatePostLock(channel.id, async () => {
        const config = await client.db.get(KEY(interaction.guildId), null);
        if (!config) return;

        const channels = config.channels && typeof config.channels === 'object'
          ? { ...config.channels }
          : {};

        // Support the older single-channel storage format.
        if (config.channelId && !channels[config.channelId]) {
          channels[config.channelId] = {
            message: config.message,
            messageId: config.messageId || null,
            enabled: config.enabled !== false,
          };
        }

        const current = channels[channel.id];
        if (!current) return;

        if (current.messageId) {
          const savedMessage = await channel.messages.fetch(current.messageId).catch(() => null);
          if (savedMessage) {
            await savedMessage.delete().catch((error) => {
              logger.warn('Could not delete saved sticky message while stopping it:', error?.message || error);
            });
          }
        }

        // Clean up any duplicate sticky copies in this channel only.
        const recent = await channel.messages.fetch({ limit: 100 }).catch((error) => {
          logger.warn('Could not scan sticky history while stopping sticky:', error?.message || error);
          return null;
        });
        if (recent) {
          for (const candidate of recent.values()) {
            if (candidate.author?.id !== client.user?.id) continue;
            const content = String(candidate.content || '');
            if (!content.endsWith(STICKY_MARKER) && content !== current.message) continue;
            await candidate.delete().catch((error) => {
              logger.warn('Could not delete a sticky copy while stopping it:', error?.message || error);
            });
          }
        }

        delete channels[channel.id];
        if (Object.keys(channels).length === 0) {
          await client.db.delete(KEY(interaction.guildId));
        } else {
          await client.db.set(KEY(interaction.guildId), {
            channels,
            updatedAt: new Date().toISOString(),
          });
        }
        stopped = true;
      });

      await interaction.editReply(stopped
        ? '✅ Sticky message stopped and removed from ' + channel + '.'
        : 'ℹ️ There is no configured sticky message in ' + channel + '.');
    } catch (error) {
      logger.error('Could not stop sticky message:', error);
      await interaction.editReply('❌ I could not fully stop the sticky message. Check TigerBot has Manage Messages permission in that channel.').catch(() => {});
    }
  },
};
