import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';

const KEY = (guildId) => 'guild:' + guildId + ':repeat-message';

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
  const channel = interaction.options.getChannel('channel');
  const message = interaction.options.getString('message');

  if (!interaction.guildId || !client?.db) {
    await interaction.reply({ content: '❌ The database is not available.', ephemeral: true });
    return;
  }

  const existing = await client.db.get(KEY(interaction.guildId), null);
  const channels = existing?.channels && typeof existing.channels === 'object' ? { ...existing.channels } : {};

  // Automatically migrate the old single-channel sticky into the new multi-channel format.
  if (existing?.channelId) {
    channels[existing.channelId] = {
      message: existing.message,
      messageId: existing.messageId || null,
      updatedAt: existing.updatedAt || new Date().toISOString(),
      enabled: existing.enabled !== false,
    };
  }

  const current = channels[channel.id];
  if (current?.messageId) {
    const oldSticky = await channel.messages.fetch(current.messageId).catch(() => null);
    if (oldSticky) await oldSticky.delete().catch(() => {});
  }

  const stickyMessage = await channel.send({
    content: message,
    allowedMentions: { parse: [] },
  });

  channels[channel.id] = {
    message,
    messageId: stickyMessage.id,
    updatedAt: new Date().toISOString(),
    enabled: true,
  };

  await client.db.set(KEY(interaction.guildId), {
    channels,
    updatedAt: new Date().toISOString(),
  });

  await interaction.reply({
    content:
      '✅ **Sticky message enabled.**\n\n' +
      '**Channel:** ' + channel + '\n' +
      '**Message:** ' + message + '\n\n' +
      'This channel is now part of your sticky system. Run `/sticky` again for other channels; each channel keeps its own sticky at the bottom.',
    ephemeral: true,
  });
}

export default { data, execute };