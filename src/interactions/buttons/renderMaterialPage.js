import { buildMaterialComponents, buildMaterialsEmbed, getRenderMaterials } from '../../services/renderMaterialUi.js';

export default {
  name: 'render_material_page',

  async execute(interaction, client, args = []) {
    const id = args[0];
    const page = Number(args[1]);
    const entry = getRenderMaterials(id);

    if (!entry) {
      return interaction.update({
        content: 'This material list has expired. Please run /render again.',
        embeds: [],
        components: []
      });
    }

    if (!Number.isInteger(page) || page < 0) {
      return interaction.update({
        embeds: [buildMaterialsEmbed(entry, 0)],
        components: buildMaterialComponents(id, entry, 0)
      });
    }

    return interaction.update({
      embeds: [buildMaterialsEmbed(entry, page)],
      components: buildMaterialComponents(id, entry, page)
    });
  }
};
