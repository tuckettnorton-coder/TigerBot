import { MessageFlags } from 'discord.js';
import {
  buildEditorPayload,
  discardDraft,
  getDraft,
  updateDraftPrice,
} from '../../commands/Utility/spawnerEditor.js';

const VALID_SPAWNERS = new Set(['skeleton', 'creeper', 'irongolem']);
const VALID_FIELDS = new Set(['buy3', 'buy64', 'sell3', 'sell64']);

export default {
  name: 'spawner_price_edit',

  async execute(interaction, client, args = []) {
    const [spawner, field] = args;

    if (!VALID_SPAWNERS.has(spawner) || !VALID_FIELDS.has(field)) {
      await interaction.reply({ content: '⚠️ Invalid spawner price edit.', flags: MessageFlags.Ephemeral });
      return;
    }

    const draft = getDraft(interaction);
    if (!draft) {
      await interaction.reply({ content: '⚠️ Your price editor expired. Run `/spawner-update` again.', flags: MessageFlags.Ephemeral });
      return;
    }

    const value = interaction.fields.getTextInputValue('price').trim();
    if (!value) {
      await interaction.reply({ content: '⚠️ Enter a price before submitting.', flags: MessageFlags.Ephemeral });
      return;
    }

    updateDraftPrice(interaction, spawner, field, value);

    if (draft.messageId && draft.channelId) {
      const channel = await client.channels.fetch(draft.channelId).catch(() => null);
      const message = channel ? await channel.messages.fetch(draft.messageId).catch(() => null) : null;
      if (message) {
        await message.edit(buildEditorPayload(draft.prices));
      }
    }

    await interaction.reply({ content: `✅ ${spawner} ${field} updated to **${value}**.`, flags: MessageFlags.Ephemeral });
  },
};

// The old multi-screen modal handler is intentionally replaced. The editor now
// uses one individual modal per price so all 12 prices remain visible together.
