import { SlashCommandBuilder } from 'discord.js';
import { requestClose } from '../../services/ticketService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('closerequest')
    .setDescription('Request confirmation to close the current ticket'),
  async execute(interaction) {
    try {
      await requestClose(interaction.channel, interaction.member);
      await interaction.reply({ content: 'Close request sent.', ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: error.message || 'Unable to request ticket closure.', ephemeral: true });
    }
  },
};
