import { MessageFlags } from 'discord.js';
import { buildEditorPayload, discardDraft, getDraft, saveDraft } from '../../commands/Utility/spawnerEditor.js';

export default {
  name: 'spawner_editor_save',

  async execute(interaction, client) {
    const draft = getDraft(interaction);
    if (!draft) {
      await interaction.reply({ content: '⚠️ Your price editor expired. Run `/spawner-update` again.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferUpdate();

    try {
      await saveDraft(interaction, client);
      await interaction.message.edit({
        content: '✅ **All 12 spawner prices have been saved and posted.**',
        embeds: [],
        components: [],
      });
    } catch (error) {
      await interaction.message.edit({
        ...buildEditorPayload(draft.prices),
        content: `⚠️ **Save failed:** ${error.message}`,
      }).catch(() => {});
    }
  },
};
