import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { requestClose } from '../../services/ticketService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('closerequest')
    .setDescription('Request confirmation to close the current ticket')
    .setDMPermission(false),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const message = await requestClose(interaction.channel, interaction.member);
      await interaction.editReply(message ? '✅ Close request sent. The ticket opener can confirm it.' : 'A close request is already pending in this ticket.');
    } catch (error) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`❌ ${error.message || 'Unable to request ticket closure.'}`).catch(() => {});
      } else {
        await interaction.reply({ content: `❌ ${error.message || 'Unable to request ticket closure.'}`, ephemeral: true }).catch(() => {});
      }
    }
  },
};
