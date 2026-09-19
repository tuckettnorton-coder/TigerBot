import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { setBuildingDraft } from '../../utils/buildingDrafts.js';

function areaMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('building_area')
      .setPlaceholder('Do you have an area dug out?')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Yes').setDescription('I already have an area ready').setValue('yes').setEmoji('✅'),
        new StringSelectMenuOptionBuilder().setLabel('No').setDescription('I need the area handled').setValue('no').setEmoji('❌')
      )
  );
}

export default { name: 'building_schematic', async execute(interaction) {
  const value = interaction.values?.[0];
  if (!['yes','no'].includes(value)) return interaction.reply({ content: '❌ Invalid schematic selection.', ephemeral: true });

  // Discord cannot open a real folder picker from a select menu. Store the answer and
  // continue to the normal ticket questions; the schematic can be uploaded in the
  // ticket immediately after creation.
  setBuildingDraft(interaction.user.id, { hasSchematic: value === 'yes' });
  await interaction.update({
    content: `### 🏗️ Building Service
**Do you have a schematic?** ${value === 'yes' ? 'Yes' : 'No'}

**Do you have an area dug out?**`,
    components: [areaMenu()]
  });
} };