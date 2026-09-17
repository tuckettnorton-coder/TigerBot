import { PermissionFlagsBits } from 'discord.js';

const UPDATE_COMMANDS = new Set([
  'spawnerupdate',
  'diggingupdate',
  'buildingupdate',
  'advertisementupdate',
  'giveawayrulesupdate',
  'partnerupdate',
]);

export default {
  name: 'update_panel',
  async execute(interaction, client, args = []) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: '❌ You need **Manage Server** permission to use the update panel.',
        ephemeral: true,
      });
      return;
    }

    const commandName = args[0];
    if (!UPDATE_COMMANDS.has(commandName)) {
      await interaction.reply({ content: '❌ This update button is not configured.', ephemeral: true });
      return;
    }

    const command = client.commands?.get(commandName);
    if (!command?.execute) {
      await interaction.reply({
        content: `❌ The \\`/${commandName}\\` command is not loaded. Restart/redeploy TigerBot and try again.`,
        ephemeral: true,
      });
      return;
    }

    // Run the exact same command logic used by the slash command.
    // Commands that open a modal will open that modal from the button click.
    await command.execute(interaction, null, client);
  },
};
