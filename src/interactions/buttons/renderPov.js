import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { makePng } from '../../commands/Tools/render.js';
import { buildRenderViewComponents, getRenderView } from '../../services/renderViewUi.js';

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

    if (!Number.isInteger(pov) || pov < 1 || pov > 5) {
      return interaction.reply({
        content: 'That POV is not valid. Choose a view from 1 to 5.',
        ephemeral: true
      });
    }

    // Acknowledge before rendering; larger schematics may take more than
    // Discord's three-second initial interaction window.
    await interaction.deferUpdate();

    const png = makePng(data, pov);
    const attachment = new AttachmentBuilder(png, { name: 'schematic-render.png' });
    const currentEmbed = interaction.message.embeds?.[0];
    const embed = currentEmbed
      ? new EmbedBuilder(currentEmbed.data)
      : new EmbedBuilder().setTitle('🧱 Minecraft Schematic');

    embed
      .setImage('attachment://schematic-render.png')
      .setFooter({
        text: 'POV ' + pov + '/5 · Minecraft-style pixel textures and visible-face shading; counts come directly from the schematic.'
      });

    return interaction.message.edit({
      embeds: [embed],
      attachments: [],
      files: [attachment],
      components: buildRenderViewComponents(id, pov)
    });
  }
};
