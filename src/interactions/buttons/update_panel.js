import { PermissionFlagsBits, MessageFlags } from 'discord.js';

export default {
  name: 'update_panel',

  async execute(interaction, client, args = []) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: '❌ You need **Manage Server** permission to use the update panel.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
      return;
    }

    const commandName = args[0];
    if (!commandName) {
      await interaction.reply({
        content: '❌ No update command was specified.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
      return;
    }

    const command = client.commands?.get(commandName);
    if (!command?.execute) {
      await interaction.reply({
        content: `❌ The update command **/${commandName}** is not available right now.`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
      return;
    }

    try {
      // The button deliberately calls the same command execute function as the
      // slash command, so both entry points use the exact same update workflow.
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
