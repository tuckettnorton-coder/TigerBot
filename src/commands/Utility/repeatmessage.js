import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';

const KEY = (guildId) => 'guild:' + guildId + ':repeat-message';

export const data = new SlashCommandBuilder()
  .setName('sticky')
  .setDescription('Set a sticky message that always stays at the bottom of the channel.')
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
  const channel = interaction.options.getChannel('channel');
  const message = interaction.options.getString('message');

  if (!interaction.guildId || !client?.db) {
    await interaction.reply({ content: '❌ The database is not available.', ephemeral: true });
    return;
  }

  const existing = await client.db.get(KEY(interaction.guildId), null);
  if (existing?.messageId && existing.channelId === channel.id) {
    const oldSticky = await channel.messages.fetch(existing.messageId).catch(() => null);
    if (oldSticky) {
      await oldSticky.delete().catch(() => {});
    }
  }

  const stickyMessage = await channel.send({
    content: message,
    allowedMentions: { parse: [] },
  });

  await client.db.set(KEY(interaction.guildId), {
    channelId: channel.id,
    message,
    messageId: stickyMessage.id,
    updatedAt: new Date().toISOString(),
    enabled: true,
  });

  await interaction.reply({
    content:
      '✅ **Sticky message enabled.**\n\n' +
      '**Channel:** ' + channel + '\n' +
      '**Message:** ' + message + '\n\n' +
      'Whenever someone sends a message in that channel, TigerBot will delete the old sticky message and repost it so the sticky always stays at the bottom.',
    ephemeral: true,
  });
}

export default { data, execute };
