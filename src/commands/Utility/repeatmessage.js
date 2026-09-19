import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';

const KEY = (guildId) => 'guild:' + guildId + ':repeat-message';

export const data = new SlashCommandBuilder()
  .setName('repeatmessage')
  .setDescription('Set a message that TigerBot deletes and reposts whenever someone sends it.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('The channel where the trigger message should be watched')
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
      '✅ **Repeat message enabled.**\n\n' +
      '**Channel:** ' + channel + '\n' +
      '**Message:** ' + message + '\n\n' +
      'Whenever someone sends that exact message in that channel, TigerBot will delete their message and repost the same message.',
    ephemeral: true,
  });
}

export default { data, execute };
