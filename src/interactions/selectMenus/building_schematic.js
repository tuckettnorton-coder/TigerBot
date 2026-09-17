import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
export default { name:'building_schematic', async execute(interaction) {
  const value=interaction.values?.[0]; if(!['yes','no'].includes(value)) return interaction.reply({content:'❌ Invalid schematic selection.',ephemeral:true});
  await interaction.update({content:`### 🏗️ Building Service\n**Do you have a schematic?** ${value==='yes'?'Yes':'No'}\n\n**Do you have an area dug out?**`,components:[new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`building_area:${value}`).setPlaceholder('Do you have an area dug out?').addOptions(new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('I already have an area ready').setValue('yes').setEmoji('✅'),new StringSelectMenuOptionBuilder().setLabel('No').setDescription('I need the area handled').setValue('no').setEmoji('❌')))]});
} };
