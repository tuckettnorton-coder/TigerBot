import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';

const SPAWNER_TYPES = [
  ['skeleton', 'Skeleton Spawner', '<:download:1517708652981780682>'],
  ['creeper', 'Creeper Spawner', '<:MinecraftCreeperHead:1517707887068315839>'],
  ['irongolem', 'Iron Golem Spawner', '<:maxresdefault:1517708562489409566>'],
];

export default {
  name: 'spawner_trade_type',
  async execute(interaction) {
    const trade = interaction.values?.[0];
    if (!['buy', 'sell'].includes(trade)) {
      await interaction.reply({ content: '❌ Invalid trade selection.', ephemeral: true });
      return;
    }

    const tradeLabel = trade === 'buy' ? 'Buy' : 'Sell';
    const options = SPAWNER_TYPES.map(([value, label, emoji]) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(label)
        .setDescription(`Select ${label}`)
        .setValue(value)
        .setEmoji(emoji),
    );

    await interaction.update({
      content: `### 💸 ${tradeLabel} Spawners\nNow select the **type of spawner** you want to ${trade}.`,
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`spawner_type:${trade}`)
            .setPlaceholder('Select a spawner type...')
            .addOptions(options),
        ),
      ],
    });
  },
};
