import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

const SPAWNER_LABELS = {
  skeleton: 'Skeleton',
  creeper: 'Creeper',
  irongolem: 'Iron Golem',
};

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
            .setCustomId('ign')
            .setLabel('IGN')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Your Minecraft username'),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('amount')
            .setLabel('Amount (Minimum 3 Spawners)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Enter 3 or more spawners'),
        ),
      );

    await interaction.showModal(modal);
  },
};
