import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

const SPAWNER_LABELS = { skeleton: 'Skeleton', creeper: 'Creeper', irongolem: 'Iron Golem' };

export default {
  name: 'spawner_type',
  async execute(interaction, client, args) {
    const trade = args?.[0];
    const spawnerType = interaction.values?.[0];
    const spawnerLabel = SPAWNER_LABELS[spawnerType];

    if (!['buy', 'sell'].includes(trade) || !spawnerLabel) {
      await interaction.reply({ content: '❌ Invalid spawner selection.', ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`ticket_form:buying_selling_spawners:${trade}:${spawnerType}`)
      .setTitle(`${trade === 'buy' ? 'Buy' : 'Sell'} ${spawnerLabel}`.slice(0, 45))
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('amount')
            .setLabel('Amount of Spawners (Minimum 3)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Example: 3, 64, 128, 1,000, 2.5k')
            .setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ign')
            .setLabel('IGN')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Your Minecraft username')
            .setRequired(true),
        ),
      );

    await interaction.showModal(modal);
  },
};
