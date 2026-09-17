import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { loadMiddlemanMessage, persistMiddlemanMessage, postMiddlemanMessage } from '../../commands/Utility/middleman-update.js';

export function buildMiddlemanUpdateModal(message = loadMiddlemanMessage()) {
  return new ModalBuilder()
    .setCustomId('middleman_update_page')
    .setTitle('Update Middleman Service')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('message')
          .setLabel('Full Middleman Service Message')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setValue(message)
          .setMaxLength(4000)
          .setPlaceholder('Enter the complete message to post in the update channel.'),
      ),
    );
}

export default {
  name: 'middleman_update_page',
  async execute(interaction, client) {
    try {
      const message = interaction.fields.getTextInputValue('message').trim();
      if (!message) throw new Error('The Middleman Service message cannot be empty.');
      persistMiddlemanMessage(message);
      await postMiddlemanMessage(client, message);
      await interaction.reply({
        content: '✅ **Official Middleman Service updated and posted in <#1519838464374476991>.**',
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      await interaction.reply({
        content: `⚠️ **Middleman update failed:** ${error?.message || 'Unknown error.'}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
