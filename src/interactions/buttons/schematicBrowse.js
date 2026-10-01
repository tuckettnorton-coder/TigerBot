import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { listSchematics, MAX_OPTIONS } from '../../services/schematicService.js';

export default {
  name: 'schematic_panel',
  async execute(interaction) {
    const entries = await listSchematics();

    if (!entries.length) {
      return interaction.reply({ content: 'No schematics have been uploaded yet.', ephemeral: true });
    }

    const options = entries.slice(-MAX_OPTIONS).reverse().map((entry) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(entry.title.slice(0, 100))
        .setValue(entry.id)
    );

    const menu = new StringSelectMenuBuilder()
      .setCustomId('schematic_select')
      .setPlaceholder('Choose a schematic...')
      .addOptions(options);

    return interaction.reply({
      content: 'Pick a schematic to download:',
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true,
    });
  },
};
