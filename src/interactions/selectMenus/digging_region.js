import { ActionRowBuilder, ModalBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export default {
  name: 'digging_region',
  async execute(interaction, client, args) {
    const area = args?.[0];
    const goodCoords = args?.[1];
    const region = interaction.values?.[0];
    if (!['yes', 'no'].includes(area) || !['yes', 'no'].includes(goodCoords) || !['yes', 'no'].includes(region)) {
      return interaction.reply({ content: '❌ Invalid digging selection.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`ticket_form:digging_services:${area}:${goodCoords}:${region}`)
      .setTitle('Digging Service')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('area_size').setLabel('Area size (width x length x height)').setStyle(TextInputStyle.Short).setPlaceholder('Example: 100 x 100 x 50').setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('area_location').setLabel('Area / Location').setStyle(TextInputStyle.Short).setPlaceholder(area === 'yes' ? 'Enter your coordinates/location' : 'Enter where you want it').setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('region_name').setLabel('Donut SMP Region').setStyle(TextInputStyle.Short).setPlaceholder(region === 'yes' ? 'West, East, Ocean, Asia, Europe' : 'None').setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('ign').setLabel('IGN').setStyle(TextInputStyle.Short).setPlaceholder('Your Minecraft username').setRequired(true),
        ),
      );

    await interaction.showModal(modal);
  },
};
