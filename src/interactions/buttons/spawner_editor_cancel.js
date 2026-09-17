import { MessageFlags } from 'discord.js';
import { discardDraft, getDraft } from '../../commands/Utility/spawnerEditor.js';

export default {
  name: 'spawner_editor_cancel',

  async execute(interaction) {
    if (!getDraft(interaction)) {
      await interaction.reply({ content: '⚠️ Your price editor has already expired.', flags: MessageFlags.Ephemeral });
      return;
    }

    discardDraft(interaction);
    await interaction.update({
      content: '❌ Spawner price update cancelled. No prices were changed.',
      embeds: [],
      components: [],
    });
  },
};
