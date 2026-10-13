import { buildMaterialComponents, buildMaterialsEmbed, getRenderMaterials } from '../../services/renderMaterialUi.js';

export default {
  name: 'render_material_picker',

  async execute(interaction, client, args = []) {
    const id = args[0];
    const page = Number(args[1]) || 0;
    const entry = getRenderMaterials(id);

    if (!entry) {
      return interaction.update({
        content: 'This material list has expired. Please run /render again.',
        embeds: [],
        components: []
      });
    }

    // Material names and counts are already visible in the dropdown options.
    // Keep the private browser open so the user can switch between options
    // without opening a separate inspection panel for every block type.
    return interaction.update({
      embeds: [buildMaterialsEmbed(entry, page)],
      components: buildMaterialComponents(id, entry, page)
    });
  }
};
