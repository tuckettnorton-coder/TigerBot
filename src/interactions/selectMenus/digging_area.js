import { ActionRowBuilder, ModalBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export default {
  name: 'digging_area',
  async execute(interaction) {
    const value = interaction.values?.[0];
    if (!['yes', 'no'].includes(value)) return interaction.reply({ content: '❌ Invalid area selection.', ephemeral: true });

    // If the customer already has an area, skip good coords and region entirely.
    if (value === 'yes') {
      const modal = new ModalBuilder()
        .setCustomId('ticket_form:digging_services:yes:no:none')
        .setTitle('Digging Service')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('area_size').setLabel('Area size (width x length x height)').setStyle(TextInputStyle.Short).setPlaceholder('100 × 10 × 50 or 100 10 50').setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ign').setLabel('IGN').setStyle(TextInputStyle.Short).setPlaceholder('Your Minecraft username').setRequired(true),
          ),
        );
      return interaction.showModal(modal);
    }

    await interaction.update({
      content: '### ⛏️ Digging Service\n**Do you want good coords?**\nSelect an option below.',
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
