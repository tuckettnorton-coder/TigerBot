import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
export default { name: 'building_farm', async execute(interaction) {
  const value = interaction.values?.[0]; if (!['yes','no'].includes(value)) return interaction.reply({content:'❌ Invalid farm selection.',ephemeral:true});
  await interaction.update({ content: `### 🏗️ Building Service\n**Is this a farm?** ${value === 'yes' ? 'Yes' : 'No'}\n\n${value === 'yes' ? 'How much does the farm make per day?' : 'What is the AH value of the build?'}`, components: [] });
  const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
  const modal = new ModalBuilder().setCustomId(`ticket_form:building_services:value:${value}`).setTitle(value === 'yes' ? 'Farm Earnings' : 'Build AH Value').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('value').setLabel(value === 'yes' ? 'Farm earnings per day' : 'AH value').setStyle(TextInputStyle.Short).setPlaceholder(value === 'yes' ? 'Example: 100M' : 'Example: 150M').setRequired(true)));
  await interaction.showModal(modal);
} };
