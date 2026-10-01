import { AttachmentBuilder } from 'discord.js';
import { getSchematic } from '../../services/schematicService.js';
import { readFile } from 'fs/promises';

export default {
  name: 'schematic_select',
  async execute(interaction) {
    const entry = await getSchematic(interaction.values?.[0]);

    if (!entry) {
      return interaction.reply({ content: 'That schematic is no longer available.', ephemeral: true });
    }

    try {
      const buffer = await readFile(entry.path);
      const attachment = new AttachmentBuilder(buffer, { name: entry.filename });

      return interaction.reply({
        content: '**' + entry.title + '**',
        files: [attachment],
        ephemeral: true,
      });
    } catch {
      return interaction.reply({ content: 'That schematic is no longer available.', ephemeral: true });
    }
  },
};
