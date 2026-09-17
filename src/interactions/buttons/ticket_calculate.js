import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export default {
  name: 'ticket_calculate',
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('ticket_calc_modal')
      .setTitle('Donut SMP Calculator');

    const input = new TextInputBuilder()
      .setCustomId('expression')
      .setLabel('Enter your calculation')
      .setPlaceholder('Example: 100M / 1000 or 2.5B + 500M')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  },
};
