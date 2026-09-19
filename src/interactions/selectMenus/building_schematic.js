import { ActionRowBuilder, FileUploadBuilder, LabelBuilder, ModalBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { setBuildingDraft } from '../../utils/buildingDrafts.js';

function areaMenu(schematic) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`building_area:${schematic}`)
      .setPlaceholder('Do you have an area dug out?')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('I already have an area ready').setValue('yes').setEmoji('✅'),
        new StringSelectMenuOptionBuilder().setLabel('No').setDescription('I need the area handled').setValue('no').setEmoji('❌')
      )
  );
}

export default { name: 'building_schematic', async execute(interaction) {
  const value = interaction.values?.[0];
  if (!['yes', 'no'].includes(value)) {
    return interaction.reply({ content: '❌ Invalid schematic selection.', ephemeral: true });
  }

  setBuildingDraft(interaction.user.id, { hasSchematic: value === 'yes' });

  if (value === 'yes') {
    const fileUpload = new FileUploadBuilder()
      .setCustomId('schematic_upload')
      .setMinValues(1)
      .setMaxValues(1)
      .setRequired(true);

    const uploadLabel = new LabelBuilder()
      .setLabel('Upload your schematic')
      .setDescription('Upload a ZIP, .schem, or .litematic file.')
      .setFileUploadComponent(fileUpload);

    const modal = new ModalBuilder()
      .setCustomId('ticket_form:building_services:building_schematic_upload')
      .setTitle('Upload a Schematic')
      .addLabelComponents(uploadLabel);

    return interaction.showModal(modal);
  }

  await interaction.update({
    content: '### 🏗️ Building Service\n**Do you have a schematic?** No\n\n**Do you have an area dug out?**',
    components: [areaMenu('no')]
  });
} };