import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { loadBuildingPrices, persistBuildingPrices, postBuildingPrices } from '../../commands/Utility/building-update.js';
export function buildBuildingPriceModal(data = loadBuildingPrices()) {
  return new ModalBuilder().setCustomId('building_price_page').setTitle('Update Building Prices').addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('prices').setLabel('Building Prices').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue([`Under 200M: ${data.under200}`,`201M+: ${data.over200}`,`Farm days: ${data.farmMultiplierDays}`].join('\n')).setPlaceholder('Under 200M: 9M\n201M+: 7M\nFarm days: 3')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('notes').setLabel('Additional Notes').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(data.notes)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('refund').setLabel('Refund Policy').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(data.refundPolicy)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rules').setLabel('Rules').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(data.rules)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket').setLabel('Ticket / Buy Instruction').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(data.ticket)),
  );
}
function parsePrices(text) {
  const lines = String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (lines.length !== 3) throw new Error('Building Prices must contain exactly 3 lines: Under 200M, 201M+, Farm days.');
  return { under200: lines[0].split(':').slice(1).join(':').trim(), over200: lines[1].split(':').slice(1).join(':').trim(), farmMultiplierDays: lines[2].split(':').slice(1).join(':').trim() };
}
export default { name: 'building_price_page', async execute(interaction, client) {
  try {
    const prices = parsePrices(interaction.fields.getTextInputValue('prices'));
    const notes = interaction.fields.getTextInputValue('notes').trim(); const refundPolicy = interaction.fields.getTextInputValue('refund').trim(); const rules = interaction.fields.getTextInputValue('rules').trim(); const ticket = interaction.fields.getTextInputValue('ticket').trim();
    if (!prices.under200 || !prices.over200 || !prices.farmMultiplierDays || !notes || !refundPolicy || !rules || !ticket) throw new Error('All building update fields are required.');
    const data = { ...prices, notes, refundPolicy, rules, ticket }; persistBuildingPrices(data); await postBuildingPrices(client, data);
    await interaction.reply({ content: '✅ **Building prices and service information have been updated and posted.**', flags: MessageFlags.Ephemeral });
  } catch (error) { await interaction.reply({ content: `⚠️ **Building price update failed:** ${error?.message || 'Unknown error.'}`, flags: MessageFlags.Ephemeral }); }
} };
