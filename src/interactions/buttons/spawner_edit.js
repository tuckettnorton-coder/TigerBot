import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

const VALID_SPAWNERS = new Set(['skeleton', 'creeper', 'irongolem']);
const VALID_FIELDS = new Set(['buy3', 'buy64', 'sell3', 'sell64']);

export default {
  name: 'spawner_edit',

  async execute(interaction, client, args = []) {
    const [spawner, field] = args;

    if (!VALID_SPAWNERS.has(spawner) || !VALID_FIELDS.has(field)) {
      await interaction.reply({ content: '⚠️ That spawner price button is invalid. Run `/spawner-update` again.', ephemeral: true });
      return;
    }

    const { getDraft, getPriceLabel } = await import('../../commands/Utility/spawnerEditor.js');
    const draft = getDraft(interaction);
    if (!draft) {
      await interaction.reply({ content: '⚠️ Your price editor expired. Run `/spawner-update` again.', ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`spawner_price_edit:${spawner}:${field}`)
      .setTitle(`Edit ${getPriceLabel(spawner, field)}`);

    const input = new TextInputBuilder()
      .setCustomId('price')
      .setLabel(getPriceLabel(spawner, field))
      .setStyle(TextInputStyle.Short)
      .setValue(String(draft.prices[spawner][field] ?? ''))
      .setRequired(true)
      .setMaxLength(100);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  },
};
