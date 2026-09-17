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
      content: '### ⛏️ Digging Service\n**Do you want a certain region?**\nSelect an option below.',
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`digging_region:${area}:${goodCoords}`)
            .setPlaceholder('Do you want a certain region?')
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('Add the custom region price').setValue('yes').setEmoji('🌎'),
              new StringSelectMenuOptionBuilder().setLabel('No').setDescription('Do not add the custom region price').setValue('no').setEmoji('❌'),
            ),
        ),
      ],
    });
  },
};
