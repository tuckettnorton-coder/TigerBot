import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
export default { name: 'building_farm', async execute(interaction) {
  const value = interaction.values?.[0];
  if (!['yes','no'].includes(value)) return interaction.reply({ content:'❌ Invalid farm selection.', ephemeral:true });
  if (value === 'no') {
    return interaction.reply({ content:'### 🏗️ Building Service\n**Do you have a schematic?**', components:[], ephemeral:true });
  }
  const modal = new ModalBuilder().setCustomId('ticket_form:building_services:value:yes').setTitle('Farm Earnings').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('value').setLabel('Farm earnings per day').setStyle(TextInputStyle.Short).setPlaceholder('Example: 100M').setRequired(true)),
  );
  await interaction.showModal(modal);
} };