import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { enableAutoGiveaway, disableAutoGiveaway, getAutoGiveawayConfig } from '../../services/autoGiveawayService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('autogiveaway')
    .setDescription('Automatically host the same giveaway every 24 hours.')
    .addSubcommand(sub => sub.setName('enable').setDescription('Enable and start the automatic 24-hour giveaway.')
      .addChannelOption(o => o.setName('channel').setDescription('Channel for the automatic giveaway.').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Giveaway description.').setMaxLength(1000).setRequired(true))
      .addStringOption(o => o.setName('prize').setDescription('What people are winning.').setMaxLength(256).setRequired(true))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners.').setMinValue(1).setMaxValue(10).setRequired(true)))
    .addSubcommand(sub => sub.setName('disable').setDescription('Disable the automatic giveaway.'))
    .addSubcommand(sub => sub.setName('status').setDescription('View the automatic giveaway settings.'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: '❌ This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: '❌ You need the Manage Server permission.', flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    if (sub === 'enable') {
      const channel = interaction.options.getChannel('channel');
      const description = interaction.options.getString('description');
      const prize = interaction.options.getString('prize');
      const winners = interaction.options.getInteger('winners');
      if (!channel?.isTextBased()) return interaction.reply({ content: '❌ Please choose a text channel.', flags: MessageFlags.Ephemeral });
      const giveaway = await enableAutoGiveaway(interaction.client, { guildId: interaction.guildId, channelId: channel.id, description, prize, winnerCount: winners, hostId: interaction.user.id });
      return interaction.reply({ content: '✅ Automatic giveaway enabled in ' + channel + '.\n\n🎁 **Prize:** ' + prize + '\n🏆 **Winners:** ' + winners + '\n⏰ **Repeats:** Every 24 hours\n\nThe first giveaway has been started now.', flags: MessageFlags.Ephemeral });
    }
    if (sub === 'disable') {
      const disabled = await disableAutoGiveaway(interaction.client, interaction.guildId);
      return interaction.reply({ content: disabled ? '✅ Automatic giveaway disabled.' : 'ℹ️ Automatic giveaway is not configured.', flags: MessageFlags.Ephemeral });
    }
    const config = await getAutoGiveawayConfig(interaction.client, interaction.guildId);
    if (!config) return interaction.reply({ content: 'ℹ️ No automatic giveaway is configured. Use /autogiveaway enable to set one up.', flags: MessageFlags.Ephemeral });
    return interaction.reply({ content: (config.enabled ? '🟢 Enabled' : '🔴 Disabled') + '\n**Channel:** <#' + config.channelId + '>\n**Prize:** ' + config.prize + '\n**Winners:** ' + config.winnerCount + '\n**Description:** ' + config.description + '\n**Repeats:** Every 24 hours', flags: MessageFlags.Ephemeral });
  },
};