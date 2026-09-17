import { MessageFlags } from 'discord.js';

export default {
  name: 'paid_ad_details',
  async execute(interaction) {
    try {
      const adName = interaction.fields.getTextInputValue('ad_name').trim();
      const adLink = interaction.fields.getTextInputValue('ad_link').trim();
      const adContent = interaction.fields.getTextInputValue('ad_content').trim();
      if (!adName || !adLink || !adContent) throw new Error('Please complete all advertisement details.');

      await interaction.reply({ content: '✅ **Advertisement received!** Staff will review the advertisement and confirm the details before posting.', flags: MessageFlags.Ephemeral });
      await interaction.channel.send({ content: `### 📝 Advertisement Details\n\n**Server / Business / Community:** ${adName}\n**Discord Invite:** ${adLink}\n\n**Advertisement Content:**\n${adContent}\n\n✅ **Submitted by:** ${interaction.user}` });
    } catch (error) {
      if (interaction.replied || interaction.deferred) await interaction.editReply(`❌ Could not submit the advertisement: ${error.message}`).catch(() => {});
      else await interaction.reply({ content: `❌ Could not submit the advertisement: ${error.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  },
};
