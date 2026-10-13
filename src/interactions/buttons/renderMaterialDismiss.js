export default {
  name: 'render_material_dismiss',

  async execute(interaction) {
    // Delete the ephemeral panel completely so it disappears when dismissed.
    return interaction.deleteReply();
  }
};
