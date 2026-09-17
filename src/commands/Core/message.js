import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('message')
    .setDescription('Send a message to a selected channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages.toString())
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('The channel where the message will be sent.')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('The message to send.')
        .setMaxLength(6000)
        .setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel', true);
    const message = interaction.options.getString('message', true);

    if (!channel.isTextBased() || !channel.isSendable()) {
      return interaction.reply({
        content: '❌ I cannot send messages to that channel.',
        ephemeral: true,
      });
    }

    try {
      await channel.send({
        content: message,
        allowedMentions: { parse: ['users', 'roles', 'everyone'] },
      });

      return interaction.reply({
        content: `✅ Message sent to <#${channel.id}>.`,
        ephemeral: true,
      });
    } catch (error) {
      return interaction.reply({
        content: '❌ I could not send the message. Make sure I have View Channel and Send Messages permissions there.',
        ephemeral: true,
      });
    }
  },
};
