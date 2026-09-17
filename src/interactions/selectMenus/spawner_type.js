import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';

const SPAWNER_LABELS = { skeleton: 'Skeleton', creeper: 'Creeper', irongolem: 'Iron Golem' };
const EMOJIS = {
  skeleton: '<:download:1517708652981780682>',
  creeper: '<:MinecraftCreeperHead:1517707887068315839>',
  irongolem: '<:maxresdefault:1517708562489409566>',
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

    const amountMenu = new StringSelectMenuBuilder()
      .setCustomId(`spawner_amount:${trade}:${spawnerType}`)
      .setPlaceholder('Select the amount of spawners')
      .addOptions(
        ['3', '4', '8', '16', '32', '64', '128', '256', '512', '1024', '2048', '4096'].map((amount) =>
          new StringSelectMenuOptionBuilder().setLabel(`${amount} Spawners`).setValue(amount).setDescription(`${amount} ${spawnerLabel} spawners`),
        ),
        new StringSelectMenuOptionBuilder().setLabel('Custom Amount').setValue('custom').setDescription('Enter any whole-number amount of 3+'),
      );

    await interaction.update({
      content: `### 📦 ${spawnerLabel} Spawners\nSelect how many spawners you want. The total will be calculated automatically using the current spawner-update prices.`,
      components: [new ActionRowBuilder().addComponents(amountMenu)],
    });
  },
};
