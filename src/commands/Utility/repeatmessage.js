import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';

const KEY = (guildId) => 'guild:' + guildId + ':repeat-message';

export const data = new SlashCommandBuilder()
  .setName('sticky')
  .setDescription('Set a sticky message that is reposted when someone sends the same message.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('The channel where the sticky message should be watched')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName('message')
      .setDescription('The exact message to delete and repost')
      .setRequired(true)
      .setMaxLength(2000),
  );

export async function execute(interaction, guildConfig, client) {
  const channel = interaction.options.getChannel('channel');
  const message = interaction.options.getString('message');

  if (!interaction.guildId || !client?.db) {
    await interaction.reply({ content: '❌ The database is not available.', ephemeral: true });
    return;
  }

  await client.db.set(KEY(interaction.guildId), {
    channelId: channel.id,
    message,
    updatedAt: new Date().toISOString(),
    enabled: true,
  });

  await interaction.reply({
    content:
      '✅ **Sticky message enabled.**\n\n' +
      '**Channel:** ' + channel + '\n' +
      '**Message:** ' + message + '\n\n' +
      'Whenever someone sends that exact message in that channel, TigerBot will delete it and repost the same message.',
    ephemeral: true,
  });
}

export default { data, execute };
