import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { isNoEditEnabled, setNoEditEnabled } from '../../services/noEditService.js';
import { logger } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('noedit')
    .setDescription('Control the server-wide edited-link protection.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand.setName('enable').setDescription('Delete link-containing edited messages across the server.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('disable').setDescription('Turn off the server-wide edited-link filter.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Check whether edited-link protection is enabled.')),

  async execute(interaction, _config, client) {
    if (!interaction.guildId) {
      await interaction.reply({ content: '❌ This command only works in a server.', ephemeral: true });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '❌ You need Manage Server permission to change this setting.', ephemeral: true });
      return;
    }

    const action = interaction.options.getSubcommand();
    if (action === 'status') {
      const enabled = await isNoEditEnabled(client, interaction.guildId);
      await interaction.reply({
        content: enabled
          ? '✅ No Edit is ENABLED server-wide. Link-containing edited messages are removed except for the four exempt roles.'
          : '⚪ No Edit is DISABLED. Edited links are not removed by this filter.',
        ephemeral: true,
      });
      return;
    }

    if (!client?.db?.set) {
      await interaction.reply({ content: '❌ Storage is unavailable, so this setting cannot be changed.', ephemeral: true });
      return;
    }

    const enabled = action === 'enable';
    try {
      await setNoEditEnabled(client, interaction.guildId, enabled, interaction.user.id);
      await interaction.reply({
        content: enabled
          ? '✅ No Edit ENABLED for all channels and threads. Edited messages containing links will be deleted unless the author has an exempt role.'
          : '✅ No Edit DISABLED. Edited messages will no longer be deleted by this filter.',
        ephemeral: true,
      });
    } catch (error) {
      logger.error('No Edit command failed to save setting:', error);
      await interaction.reply({
        content: '❌ Failed to save the No Edit setting. Try again.',
        ephemeral: true,
      });
    }
  },
};
