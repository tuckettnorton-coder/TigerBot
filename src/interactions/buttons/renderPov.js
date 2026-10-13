import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { runRenderWorker } from '../../services/renderWorker.js';
import { getOrCreateRenderPng } from '../../services/renderPngCache.js';
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

    // Record the newest click before yielding. If several POVs are clicked in
    // quick succession, only the latest request should update the preview.
    const requestSequence = (data.renderRequestSequence || 0) + 1;
    data.renderRequestSequence = requestSequence;
    data.renderRequestedPov = pov;

    // Acknowledge immediately, before any texture or image work.
    await interaction.deferUpdate();

    // Do not start rendering if this click was superseded while Discord was
    // acknowledging it.
    if (data.renderRequestSequence !== requestSequence) return;

    try {
      const textureMap = data.renderTextures || await loadVanillaTextureMap(data);
      data.renderTextures = textureMap;

      // The expensive PNG rasterizer runs in a worker thread, not on the bot's
      // main event loop. Identical in-progress POV clicks share one render.
      const png = await getOrCreateRenderPng(id, pov, () =>
        runRenderWorker('render', {
          data: { size: data.size, blocks: data.blocks },
          pov,
          textureMap
        }, {
          shouldCancel: () => data.renderRequestedPov !== pov
        })
      );

      // A queued render can be skipped if the user has already chosen another
      // view; an identical latest request can still share the active render.
      if (!png || data.renderRequestSequence !== requestSequence) return;

      const attachment = new AttachmentBuilder(png, { name: 'schematic-render.png' });
      const currentEmbed = interaction.message.embeds?.[0];
      const embed = currentEmbed
        ? new EmbedBuilder(currentEmbed.data)
        : new EmbedBuilder().setTitle('🧱 Minecraft Schematic');

      embed
        .setImage('attachment://schematic-render.png')
        .setFooter({ text: 'POV ' + pov + '/10 · ' + POV_DESCRIPTIONS[pov] });

      const payload = {
        embeds: [embed],
        attachments: [],
        files: [attachment],
        components: buildRenderViewComponents(id, pov)
      };

      // Serialize final edits for this schematic, so two fast clicks cannot
      // finish out of order and leave the earlier POV displayed last.
      const previousUpdate = data.renderUpdateQueue || Promise.resolve();
      const nextUpdate = previousUpdate.catch(() => {}).then(() => {
        if (data.renderRequestSequence !== requestSequence) return;
        return interaction.editReply(payload);
      });
      data.renderUpdateQueue = nextUpdate.catch(() => {});
      return await nextUpdate;
    } catch (error) {
      // The interaction has already been acknowledged, so report a render
      // failure privately instead of leaving a permanent loading indicator.
      if (data.renderRequestSequence === requestSequence) {
        return interaction.followUp({
          content: 'Could not load that POV. Please click the view again. (' +
            String(error?.message || 'render error').slice(0, 180) + ')',
          ephemeral: true
        });
      }
    }
  }
};
