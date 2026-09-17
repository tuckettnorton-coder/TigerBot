import { ActionRowBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getMiddlemanDraft, setMiddlemanDraft } from '../../utils/middlemanDrafts.js';

const LABELS = { skeleton: 'Skeleton', creeper: 'Creeper', irongolem: 'Iron Golem' };

export default {
  name: 'middleman_spawner_trade',
  async execute(interaction, client, args) {
    const spawnerType = args?.[0];
    const trade = interaction.values?.[0];
    const draft = getMiddlemanDraft(interaction.user.id);
    if (!draft?.yourIgn || !draft?.personIgn || draft.spawnersInvolved !== 'yes' || !LABELS[spawnerType] || !['buy', 'sell'].includes(trade)) {
      return interaction.reply({ content: '❌ Your Middleman ticket session expired. Please start the ticket again.', ephemeral: true });
    }

    setMiddlemanDraft(interaction.user.id, { spawnerType, trade });

    const modal = new ModalBuilder()
      .setCustomId('middleman_details:spawner')
      .setTitle(`${trade === 'buy' ? 'Buy' : 'Sell'} ${LABELS[spawnerType]}`.slice(0, 45))
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('spawner_amount')
            .setLabel('How many spawners?')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Example: 64, 128, 1K, 2.5K')
            .setRequired(true),
        ),
      );

    await interaction.showModal(modal);
  },
};
