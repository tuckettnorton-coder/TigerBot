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

    // Compatibility for a dropdown from a render message created before this
    // update: replace it with the new plain material list panel. No per-block
    // inspection panel is opened.
    return interaction.update({
      embeds: [buildMaterialsEmbed(entry, page)],
      components: buildMaterialComponents(id, entry, page)
    });
  }
};
