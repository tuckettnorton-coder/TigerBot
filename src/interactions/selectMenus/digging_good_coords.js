import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';

export default {
  name: 'digging_good_coords',
  async execute(interaction, client, args) {
    const area = args?.[0];
    const goodCoords = interaction.values?.[0];
    if (!['yes', 'no'].includes(area) || !['yes', 'no'].includes(goodCoords)) {
      return interaction.reply({ content: '❌ Invalid digging selection.', ephemeral: true });
    }

    await interaction.update({
      content: '### ⛏️ Digging Service\n**Do you want a certain region?**\nSelect a Donut SMP region below.',
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`digging_region:${area}:${goodCoords}`)
            .setPlaceholder('Select a Donut SMP region')
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel('West').setDescription('Donut SMP West').setValue('west').setEmoji('🌎'),
              new StringSelectMenuOptionBuilder().setLabel('East').setDescription('Donut SMP East').setValue('east').setEmoji('🌎'),
              new StringSelectMenuOptionBuilder().setLabel('Ocean').setDescription('Donut SMP Ocean').setValue('ocean').setEmoji('🌊'),
              new StringSelectMenuOptionBuilder().setLabel('Asia').setDescription('Donut SMP Asia').setValue('asia').setEmoji('🌏'),
              new StringSelectMenuOptionBuilder().setLabel('Europe').setDescription('Donut SMP Europe').setValue('europe').setEmoji('🌍'),
              new StringSelectMenuOptionBuilder().setLabel('None').setDescription('No specific region').setValue('none').setEmoji('❌'),
            ),
        ),
      ],
    });
  },
};
