import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
export default { name:'building_region', async execute(interaction,client,args) {
  const schematic=args?.[0], good=args?.[1], region=interaction.values?.[0]; if(!['yes','no'].includes(schematic)||!['yes','no'].includes(good)||!['west','east','ocean','asia','europe','none'].includes(region)) return interaction.reply({content:'❌ Invalid building region selection.',ephemeral:true});
  const modal=new ModalBuilder().setCustomId(`ticket_form:building_services:final:${schematic}:no:yes:${good}:${region}`).setTitle('Building Service').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('confirm').setLabel('Ready to create ticket?').setStyle(TextInputStyle.Short).setValue('Yes').setRequired(true)));
  await interaction.showModal(modal);
} };
