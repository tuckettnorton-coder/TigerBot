import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { getMiddlemanDraft, setMiddlemanDraft } from '../../utils/middlemanDrafts.js';

const LABELS = { skeleton: 'Skeleton', creeper: 'Creeper', irongolem: 'Iron Golem' };

function tradeMenu(spawnerType) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`middleman_spawner_trade:${spawnerType}`)
      .setPlaceholder(`Buy or Sell ${LABELS[spawnerType]}`)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Buy').setDescription(`Buying ${LABELS[spawnerType]} spawners`).setValue('buy').setEmoji('📥'),
        new StringSelectMenuOptionBuilder().setLabel('Sell').setDescription(`Selling ${LABELS[spawnerType]} spawners`).setValue('sell').setEmoji('📤'),
      ),
  );
}

export default {
  name: 'middleman_spawner_type',
  async execute(interaction) {
    const spawnerType = interaction.values?.[0];
    const draft = getMiddlemanDraft(interaction.user.id);
    if (!draft?.yourIgn || !draft?.personIgn || !LABELS[spawnerType]) {
      return interaction.reply({ content: '❌ Your Middleman ticket session expired. Please start the ticket again.', ephemeral: true });
    }

    setMiddlemanDraft(interaction.user.id, { spawnerType });
    await interaction.update({
      content: `### 🤝 Middleman Service\n**Spawner:** ${LABELS[spawnerType]}\n\n**Are you buying or selling?**`,
      components: [tradeMenu(spawnerType)],
    });
  },
};
