import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { getCachedRenderPng, hasCachedRenderPng } from '../../services/renderPngCache.js';
import { buildRenderViewComponents, getRenderView } from '../../services/renderViewUi.js';
import { logger } from '../../utils/logger.js';

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

    // Every enabled POV button points to an image already in cache. Use one
    // atomic component interaction response to acknowledge and change the image.
    const png = getCachedRenderPng(id, pov);
    if (!png) {
      return interaction.reply({
        content: 'That POV preview is not ready yet. Its button will enable automatically when the image is available.',
        ephemeral: true
      });
    }

    data.renderActivePov = pov;
    const attachment = new AttachmentBuilder(png, { name: 'schematic-render.png' });
    const currentEmbed = interaction.message.embeds?.[0];
    const embed = currentEmbed
      ? new EmbedBuilder(currentEmbed.data)
      : new EmbedBuilder().setTitle('🧱 Minecraft Schematic');

    embed
      .setImage('attachment://schematic-render.png')
      .setFooter({ text: 'POV ' + pov + '/10 · ' + POV_DESCRIPTIONS[pov] });

    const readyPovs = new Set();
    for (let index = 1; index <= 10; index++) {
      if (hasCachedRenderPng(id, index)) readyPovs.add(index);
    }
    data.renderReadyPovs = readyPovs;

    try {
      return await interaction.update({
        embeds: [embed],
        attachments: [],
        files: [attachment],
        components: buildRenderViewComponents(id, pov, readyPovs)
      });
    } catch (error) {
      logger.error('Atomic POV update failed for ' + id + ' / POV ' + pov + ':', error);
      const content = 'TigerBot could not update that preview. Please try the button again.';
      try {
        if (interaction.deferred || interaction.replied) {
          return await interaction.followUp({ content, ephemeral: true });
        }
        return await interaction.reply({ content, ephemeral: true });
      } catch {
        return null;
      }
    }
  }
};
