import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
export default { name:'building_dig', async execute(interaction,client,args) {
  const schematic=args?.[0], dig=interaction.values?.[0]; if(!['yes','no'].includes(schematic)||!['yes','no'].includes(dig)) return interaction.reply({content:'❌ Invalid digging selection.',ephemeral:true});
  if(dig==='no') { const modal=new ModalBuilder().setCustomId(`ticket_form:building_services:final:${schematic}:no:no:none`).setTitle('Building Service').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ign').setLabel('IGN').setStyle(TextInputStyle.Short).setPlaceholder('Your Minecraft username').setRequired(true))); return interaction.showModal(modal); }
  const modal=new ModalBuilder().setCustomId(`ticket_form:building_services:digstart:${schematic}`).setTitle('Digging Area').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('area_size').setLabel('Area size (width x length x height)').setStyle(TextInputStyle.Short).setPlaceholder('Example: 100 x 100 x 50').setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ign').setLabel('IGN').setStyle(TextInputStyle.Short).setPlaceholder('Your Minecraft username').setRequired(true)),
  ); await interaction.showModal(modal);
} };
