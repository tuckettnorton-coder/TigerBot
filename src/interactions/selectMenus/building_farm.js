import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
function schematicMenu(){return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('building_schematic').setPlaceholder('Do you have a schematic?').addOptions(new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('I have a schematic').setValue('yes').setEmoji('✅'),new StringSelectMenuOptionBuilder().setLabel('No').setDescription('I do not have a schematic').setValue('no').setEmoji('❌')));}
export default { name:'building_farm', async execute(interaction){
 const value=interaction.values?.[0];
 if(!['yes','no'].includes(value))return interaction.reply({content:'❌ Invalid farm selection.',ephemeral:true});
 if(value==='no')return interaction.update({content:'### 🏗️ Building Service\n**Do you have a schematic?**',components:[schematicMenu()]});
 const modal=new ModalBuilder().setCustomId('ticket_form:building_services:value:yes').setTitle('Farm Earnings').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('value').setLabel('Farm earnings per day').setStyle(TextInputStyle.Short).setPlaceholder('Example: 100M').setRequired(true)));
 await interaction.showModal(modal);
} };