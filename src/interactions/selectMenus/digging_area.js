import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';

function menu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('digging_area')
      .setPlaceholder('Do you have an area?')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('I already have an area/location').setValue('yes').setEmoji('✅'),
        new StringSelectMenuOptionBuilder().setLabel('No').setDescription('I need the builder to choose the area').setValue('no').setEmoji('❌'),
      ),
  );
}

export default {
  name: 'digging_area',
  async execute(interaction) {
    const value = interaction.values?.[0];
    if (!['yes', 'no'].includes(value)) return interaction.reply({ content: '❌ Invalid area selection.', ephemeral: true });
    await interaction.update({
      content: `### ⛏️ Digging Service\n**Do you want good coords?**\nSelect an option below.`,
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`digging_good_coords:${value}`)
            .setPlaceholder('Do you want good coords?')
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('Add the good coords price').setValue('yes').setEmoji('📍'),
              new StringSelectMenuOptionBuilder().setLabel('No').setDescription('Do not add the good coords price').setValue('no').setEmoji('❌'),
            ),
        ),
      ],
    });
  },
};
