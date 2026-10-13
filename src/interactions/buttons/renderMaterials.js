import { buildMaterialComponents, buildMaterialsEmbed, getRenderMaterials } from '../../services/renderMaterialUi.js';

export default {
  name: 'render_materials',

  async execute(interaction, client, args = []) {
    const entry = getRenderMaterials(args[0]);
    if (!entry) {
      return interaction.reply({
        content: 'This material list has expired. Please run /render again.',
        ephemeral: true
      });
    }

    return interaction.reply({
      embeds: [buildMaterialsEmbed(entry, 0)],
      components: buildMaterialComponents(args[0], entry, 0),
      ephemeral: true
    });
  }
};
