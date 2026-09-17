import { ActionRowBuilder, ModalBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getMiddlemanDraft, setMiddlemanDraft } from '../../utils/middlemanDrafts.js';

function spawnerTypeMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('middleman_spawner_type')
      .setPlaceholder('Which spawner type?')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Skeleton').setDescription('Skeleton spawners').setValue('skeleton'),
        new StringSelectMenuOptionBuilder().setLabel('Creeper').setDescription('Creeper spawners').setValue('creeper'),
        new StringSelectMenuOptionBuilder().setLabel('Iron Golem').setDescription('Iron Golem spawners').setValue('irongolem'),
      ),
  );
}

function otherValueModal() {
  return new ModalBuilder()
    .setCustomId('middleman_details:other')
    .setTitle('Middleman Value')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('total_value')
          .setLabel('How much money/value is involved?')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Example: 100M, 1.5B, 250K')
          .setRequired(true),
      ),
    );
}

export default {
  name: 'middleman_spawners',
  async execute(interaction) {
    const value = interaction.values?.[0];
    const draft = getMiddlemanDraft(interaction.user.id);
    if (!draft?.yourIgn || !draft?.personIgn || !['yes', 'no'].includes(value)) {
      return interaction.reply({ content: '❌ Your Middleman ticket session expired. Please start the ticket again.', ephemeral: true });
    }

    setMiddlemanDraft(interaction.user.id, { spawnersInvolved: value });

    if (value === 'no') {
      return interaction.showModal(otherValueModal());
    }

    await interaction.update({
      content: '### 🤝 Middleman Service\n**Which type of spawner is involved?**',
      components: [spawnerTypeMenu()],
    });
  },
};
