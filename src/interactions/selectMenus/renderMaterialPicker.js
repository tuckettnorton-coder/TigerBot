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

    const selectedIndex = Number(interaction.values?.[0]);
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= entry.counts.length) {
      return interaction.update({
        embeds: [buildMaterialsEmbed(entry, page)],
        components: buildMaterialComponents(id, entry, page)
      });
    }

    return interaction.update({
      embeds: [buildMaterialsEmbed(entry, page, selectedIndex)],
      components: buildMaterialComponents(id, entry, page)
    });
  }
};
