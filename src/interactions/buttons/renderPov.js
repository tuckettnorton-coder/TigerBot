import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { makePng } from '../../commands/Tools/render.js';
import { buildRenderViewComponents, getRenderView } from '../../services/renderViewUi.js';
import { loadVanillaTextureMap } from '../../services/renderTextures.js';

const POV_DESCRIPTIONS = {
  1: 'Front · full exterior view',
  2: 'Back · exact opposite exterior view',
  3: 'Underneath · looking at the underside',
  4: 'Top cut · 1 top layer removed',
  5: 'Top cut · 2 top layers removed',
  6: 'Top cut · 3 top layers removed',
  7: 'Top cut · 4 top layers removed',
  8: 'Half cut · front half retained at the midpoint',
  9: 'Half cut · opposite half retained at the midpoint',
  10: 'Half cut · side half retained at the midpoint'
};

export default {
  name: 'render_pov',

  async execute(interaction, client, args = []) {
    const id = args[0];
    const pov = Number(args[1]);
    const data = getRenderView(id);

    if (!data) {
      return interaction.reply({
        content: 'This render preview has expired. Please run /render again.',
        ephemeral: true
      });
    }

    if (!Number.isInteger(pov) || pov < 1 || pov > 10) {
      return interaction.reply({
        content: 'That POV is not valid. Choose a view from 1 to 10.',
        ephemeral: true
      });
    }

    // Acknowledge before rendering; high-resolution schematics can take longer
    // than Discord's initial three-second interaction window.
    await interaction.deferUpdate();

    const textureMap = data.renderTextures || await loadVanillaTextureMap(data);
    data.renderTextures = textureMap;

    // Reuse recently viewed angles rather than rebuilding a 2400×1800 PNG
    // on every click. Two cached PNGs per schematic keep memory use bounded.
    if (!(data.renderPngCache instanceof Map)) data.renderPngCache = new Map();
    let png = data.renderPngCache.get(pov);
    if (png) {
      data.renderPngCache.delete(pov);
      data.renderPngCache.set(pov, png);
    } else {
      png = makePng(data, pov, textureMap);
      data.renderPngCache.set(pov, png);
      while (data.renderPngCache.size > 2) {
        data.renderPngCache.delete(data.renderPngCache.keys().next().value);
      }
    }
    const attachment = new AttachmentBuilder(png, { name: 'schematic-render.png' });
    const currentEmbed = interaction.message.embeds?.[0];
    const embed = currentEmbed
      ? new EmbedBuilder(currentEmbed.data)
      : new EmbedBuilder().setTitle('🧱 Minecraft Schematic');

    embed
      .setImage('attachment://schematic-render.png')
      .setFooter({ text: 'POV ' + pov + '/10 · ' + POV_DESCRIPTIONS[pov] });

    // The interaction's original response is the clicked message. Editing it
    // through the acknowledged interaction webhook is more reliable than a
    // second channel-message PATCH after deferUpdate().
    return interaction.editReply({
      embeds: [embed],
      attachments: [],
      files: [attachment],
      components: buildRenderViewComponents(id, pov)
    });
  }
};
