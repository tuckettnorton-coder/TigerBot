import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
export default { name: 'building_start', async execute(interaction) {
  const modal = new ModalBuilder().setCustomId('ticket_form:building_services:start').setTitle('Building Service').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('what_built').setLabel('What do you want built?').setStyle(TextInputStyle.Paragraph).setPlaceholder('Describe the farm, stash, or custom build').setRequired(true)),
  ); await interaction.showModal(modal);
} };
