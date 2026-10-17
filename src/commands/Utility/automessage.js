import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';

const KEY = (guildId) => 'guild:' + guildId + ':auto-message';

export default {
  data: new SlashCommandBuilder()
    .setName('automessage')
    .setDescription('Set up a message that automatically repeats in a channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Set or update the repeating automatic message.')
        .addChannelOption((option) =>
          option.setName('channel')
            .setDescription('Channel where the message will repeat')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true))
        .addStringOption((option) =>
          option.setName('message')
            .setDescription('Message to repeat')
            .setMaxLength(2000)
            .setRequired(true))
        .addIntegerOption((option) =>
          option.setName('minutes')
            .setDescription('Minutes between messages (1–10080)')
            .setMinValue(1)
            .setMaxValue(10080)
            .setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('stop')
        .setDescription('Stop the automatic repeating message.')),

  async execute(interaction, _guildConfig, client) {
    if (!interaction.guildId || !client?.db) {
      await interaction.reply({ content: '❌ The database is not available.', ephemeral: true });
      return;
    }

    const key = KEY(interaction.guildId);
    const action = interaction.options.getSubcommand();

    if (action === 'stop') {
      const current = await client.db.get(key, null);
      if (!current?.enabled) {
        await interaction.reply({ content: 'ℹ️ There is no active automatic message.', ephemeral: true });
        return;
      }
      await client.db.set(key, { ...current, enabled: false, updatedAt: new Date().toISOString() });
      await interaction.reply({ content: '✅ Automatic message stopped.', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel', true);
    const message = interaction.options.getString('message', true).trim();
    const minutes = interaction.options.getInteger('minutes', true);

    if (!message) {
      await interaction.reply({ content: '❌ The automatic message cannot be empty.', ephemeral: true });
      return;
    }

    const botPermissions = channel.permissionsFor(interaction.guild.members.me);
    if (!botPermissions?.has(PermissionFlagsBits.ViewChannel) ||
        !botPermissions?.has(PermissionFlagsBits.SendMessages)) {
      await interaction.reply({ content: '❌ I need View Channel and Send Messages permissions in that channel.', ephemeral: true });
      return;
    }

    const now = Date.now();
    await client.db.set(key, {
      guildId: interaction.guildId,
      channelId: channel.id,
      message,
      intervalMinutes: minutes,
      nextRunAt: now + minutes * 60_000,
      enabled: true,
      updatedAt: new Date(now).toISOString(),
      updatedBy: interaction.user.id,
    });

    await interaction.reply({
      content: '✅ **Automatic message enabled.**\n\n**Channel:** ' + channel +
        '\n**Repeat every:** ' + minutes + ' minute(s)' +
        '\n**Message:** ' + message +
        '\n\nThe first automatic post will be sent after the selected interval. Use `/automessage stop` to stop it.',
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
  },
};
