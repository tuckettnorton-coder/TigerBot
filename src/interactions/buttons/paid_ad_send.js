import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export default [
  {
    name: 'paid_ad_send_yes',
    async execute(interaction) {
      const modal = new ModalBuilder().setCustomId('paid_ad_details').setTitle('Advertisement Details').addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ad_name').setLabel('Server / Business / Community Name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder('Your server or business name')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ad_link').setLabel('Discord Invite Link').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder('https://discord.gg/...')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ad_content').setLabel('Advertisement Content').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000).setPlaceholder('Paste the ad you want posted')),
      );
      await interaction.showModal(modal);
    },
  },
  {
    name: 'paid_ad_send_ok',
    async execute(interaction) {
      const modal = new ModalBuilder().setCustomId('paid_ad_details').setTitle('Advertisement Details').addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ad_name').setLabel('Server / Business / Community Name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder('Your server or business name')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ad_link').setLabel('Discord Invite Link').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setPlaceholder('https://discord.gg/...')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ad_content').setLabel('Advertisement Content').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000).setPlaceholder('Paste the ad you want posted')),
      );
      await interaction.showModal(modal);
    },
  },
];
