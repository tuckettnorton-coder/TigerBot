import { PermissionFlagsBits, MessageFlags } from 'discord.js';

const UPDATE_COMMANDS = new Set([
  'spawner-update',
  'digging-update',
  'building-update',
  'shulker-update',
  'paid-ad-update',
  'giveawayrulesupdate',
  'partnerupdate',
]);

export default {
  name: 'update_panel',

  async execute(interaction, client, args = []) {
    const memberPermissions = interaction.memberPermissions || interaction.member?.permissions;
    if (!memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: '❌ You need **Manage Server** permission to use the update panel.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
      return;
    }

    const commandName = args[0];
    if (!commandName) {
      await interaction.reply({ content: '❌ No update command was specified.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return;
    }

    if (!UPDATE_COMMANDS.has(commandName)) {
      await interaction.reply({
        content: '❌ This update button is not configured.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
      return;
    }

    const command = client.commands?.get(commandName);
    if (!command?.execute) {
      await interaction.reply({
        content: `❌ The update command **/${commandName}** is not loaded. Restart/redeploy TigerBot and try again.`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
      return;
    }

    try {
      await command.execute(interaction, null, client);
    } catch (error) {
      const message = `❌ **${commandName} failed:** ${error?.message || 'Unknown error.'}`;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: message }).catch(() => {});
      } else {
        await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  },
};
