import { AttachmentBuilder, MessageFlags } from 'discord.js';
import { getTranscript } from '../../services/transcriptStore.js';

export default {
  name: 'transcript:',
  async execute(interaction) {
    const token = interaction.customId;

    if (!token.startsWith('transcript:')) return;

    const transcript = getTranscript(token);
    if (!transcript) {
      await interaction.reply({
        content: 'This transcript is no longer available. Please ask a staff member to regenerate it.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: '📄 Here is your transcript file.',
      files: [
        new AttachmentBuilder(transcript.buffer, {
          name: transcript.fileName,
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
