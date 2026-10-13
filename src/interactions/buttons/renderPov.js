import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { makePng } from '../../commands/Tools/render.js';
import { buildRenderViewComponents, getRenderView } from '../../services/renderViewUi.js';

const POV_DESCRIPTIONS = {
  1: 'Exterior view · front corner',
  2: 'Exterior view · second corner',
  3: 'Exterior view · third corner',
  4: 'Top cutaway · 1 top layer removed',
  5: 'Top cutaway · 2 top layers removed',
  6: 'Top cutaway · 3 top layers removed',
  7: 'Top cutaway · 4 top layers removed',
  8: 'Side cutaway · half removed from the X-facing side',
  9: 'Side cutaway · half removed from the Z-facing side',
  10: 'Opposite-side cutaway · half removed from the other side'
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

    const png = makePng(data, pov);
    const attachment = new AttachmentBuilder(png, { name: 'schematic-render.png' });
    const currentEmbed = interaction.message.embeds?.[0];
    const embed = currentEmbed
      ? new EmbedBuilder(currentEmbed.data)
      : new EmbedBuilder().setTitle('🧱 Minecraft Schematic');

    embed
      .setImage('attachment://schematic-render.png')
      .setFooter({ text: 'POV ' + pov + '/10 · ' + POV_DESCRIPTIONS[pov] });

    return interaction.message.edit({
      embeds: [embed],
      attachments: [],
      files: [attachment],
      components: buildRenderViewComponents(id, pov)
    });
  }
};
