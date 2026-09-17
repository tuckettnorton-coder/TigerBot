import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

const LABELS = { skeleton: 'Skeleton', creeper: 'Creeper', irongolem: 'Iron Golem' };

function buildIgnModal(trade, spawnerType, amount) {
  return new ModalBuilder()
    .setCustomId(`ticket_form:buying_selling_spawners:${trade}:${spawnerType}:${amount}`)
    .setTitle(`${trade === 'buy' ? 'Buy' : 'Sell'} ${LABELS[spawnerType]}`.slice(0, 45))
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('ign').setLabel('IGN').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Your Minecraft username'),
    ));
}

function buildCustomAmountModal(trade, spawnerType) {
  return new ModalBuilder()
    .setCustomId(`ticket_form:buying_selling_spawners:${trade}:${spawnerType}:custom`)
    .setTitle('Custom Spawner Amount')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('amount').setLabel('Amount (Minimum 3)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Example: 100, 1,000, or 2.5k'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ign').setLabel('IGN').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Your Minecraft username'),
      ),
    );
}

export default {
  name: 'spawner_amount',
  async execute(interaction, client, args) {
    const trade = args?.[0];
    const spawnerType = args?.[1];
    const amount = interaction.values?.[0];
    if (!['buy', 'sell'].includes(trade) || !LABELS[spawnerType] || !amount) {
      await interaction.reply({ content: '❌ Invalid amount selection.', ephemeral: true });
      return;
    }
    if (amount === 'custom') {
      await interaction.showModal(buildCustomAmountModal(trade, spawnerType));
      return;
    }
    await interaction.showModal(buildIgnModal(trade, spawnerType, amount));
  },
};
