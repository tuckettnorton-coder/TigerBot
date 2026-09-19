import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, LabelBuilder, FileUploadBuilder } from 'discord.js';
export default { name:'building_schematic', async execute(interaction) {
  const value=interaction.values?.[0]; if(!['yes','no'].includes(value)) return interaction.reply({content:'❌ Invalid schematic selection.',ephemeral:true});
  if(value==='yes'){
    const modal=new ModalBuilder().setCustomId('ticket_form:building_schematic_upload').setTitle('Upload a Schematic');
    const upload=new FileUploadBuilder().setCustomId('schematic_upload').setMinValues(1).setMaxValues(1).setRequired(true).setFileTypes('.zip','.schem','.litematic');
    modal.addLabelComponents(new LabelBuilder().setLabel('Upload a schematic').setDescription('Upload your schematic file. For a schematic folder, ZIP the folder first.').setFileUploadComponent(upload));
    return interaction.showModal(modal);
  }
  await interaction.update({content:'### 🏗️ Building Service\n**Do you have a schematic?** No\n\n**Do you have an area dug out?**',components:[new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('building_area:no').setPlaceholder('Do you have an area dug out?').addOptions(new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('I already have an area ready').setValue('yes').setEmoji('✅'),new StringSelectMenuOptionBuilder().setLabel('No').setDescription('I need the area handled').setValue('no').setEmoji('❌')))]});
} };