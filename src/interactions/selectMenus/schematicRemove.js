import { PermissionFlagsBits } from 'discord.js';
import { removeSchematic } from '../../services/schematicService.js';

export default {
  name: 'schematic_remove_select',

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.update({
        content: "❌ You don't have permission to manage schematics.",
        components: [],
      });
    }

    const id = interaction.values?.[0];
    if (!id) {
      return interaction.update({
        content: '❌ No schematic was selected.',
        components: [],
      });
    }

    try {
      const entry = await removeSchematic(id);

      if (!entry) {
        return interaction.update({
          content: '⚠️ That schematic is no longer in the library. Run `/schematic remove` again to choose another one.',
          components: [],
        });
      }

      return interaction.update({
        content: '🗑️ Removed **' + String(entry.title || entry.filename || 'Schematic').slice(0, 100) +
          '** from the schematic library and download panel.',
        components: [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      return interaction.update({
        content: '❌ Failed to remove the schematic: ' + message.slice(0, 1500),
        components: [],
      });
    }
  },
};
