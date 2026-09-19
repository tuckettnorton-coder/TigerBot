import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getSpawnerDraft } from '../../utils/spawnerPricing.js';

const LABELS = { skeleton: 'Skeleton', creeper: 'Creeper', irongolem: 'Iron Golem' };

function buildIgnModal(trade, spawnerType) {
  return new ModalBuilder()
    .setCustomId(`ticket_form:buying_selling_spawners:${trade}:${spawnerType}:custom`)
    .setTitle(`${trade === 'buy' ? 'Buy' : 'Sell'} ${LABELS[spawnerType]}`.slice(0, 45))
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel('Amount (Minimum 3)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Example: 100, 1,000, or 2.5k')),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ign').setLabel('IGN').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Your Minecraft username')),
    );
}

export default {
  name: 'spawner_amount',
  async execute(interaction, client, args) {
    if (args?.[0] === 'more') {
      const actualTrade = args?.[1];
      const draft = getSpawnerDraft(interaction.user.id);
      if (!draft || draft.trade !== actualTrade) return interaction.reply({ content: '❌ Your spawner selection expired. Please start the spawner ticket again.', ephemeral: true });
      return interaction.update({
        content: `### 💸 Add Another Spawner
**Choose the next spawner type you want to ${actualTrade}.**`,
        components: [new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId(`spawner_type:${actualTrade}`).setPlaceholder('Choose a spawner type...').addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Skeleton Spawner').setDescription('Add Skeleton spawners').setValue('skeleton').setEmoji('<:download:1517708652981780682>'),
            new StringSelectMenuOptionBuilder().setLabel('Creeper Spawner').setDescription('Add Creeper spawners').setValue('creeper').setEmoji('<:MinecraftCreeperHead:1517707887068315839>'),
            new StringSelectMenuOptionBuilder().setLabel('Iron Golem Spawner').setDescription('Add Iron Golem spawners').setValue('irongolem').setEmoji('<:maxresdefault:1517708562489409566>'),
          )
        )],
      });
    }

    const trade = args?.[0];
    const spawnerType = args?.[1];
    const amount = interaction.values?.[0];
    if (!['buy', 'sell'].includes(trade) || !LABELS[spawnerType] || !amount) return interaction.reply({ content: '❌ Invalid amount selection.', ephemeral: true });
    if (amount === 'custom') return interaction.showModal(buildIgnModal(trade, spawnerType));
    await interaction.showModal(new ModalBuilder()
      .setCustomId(`ticket_form:buying_selling_spawners:${trade}:${spawnerType}:${amount}`)
      .setTitle(`${trade === 'buy' ? 'Buy' : 'Sell'} ${LABELS[spawnerType]}`.slice(0, 45))
      .addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('ign').setLabel('IGN').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Your Minecraft username'),
      )));
  },
};
