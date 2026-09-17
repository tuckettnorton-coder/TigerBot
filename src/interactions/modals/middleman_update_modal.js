import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { loadMiddlemanFees, saveMiddlemanFees, buildMiddlemanServiceMessage } from '../../utils/middlemanPricing.js';
import { parseAmount, formatResult } from '../../utils/calculator.js';
import { postMiddlemanMessage, persistMiddlemanMessage } from '../../commands/Utility/middleman-update.js';

function moneyInput(customId, label, value, placeholder) {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(String(value))
      .setMaxLength(30)
      .setPlaceholder(placeholder),
  );
}

export function buildMiddlemanUpdateModal(fees = loadMiddlemanFees()) {
  return new ModalBuilder()
    .setCustomId('middleman_update_page')
    .setTitle('Update Middleman Fees')
    .addComponents(
      moneyInput('spawner_fee', 'Standard fee per spawner', formatResult(fees.spawnerFee), 'Example: 50K'),
      moneyInput('bulk_spawner_fee', '64+ fee per spawner', formatResult(fees.bulkSpawnerFee), 'Example: 25K'),
      moneyInput('other_service_percent', 'Other service fee %', fees.otherServicePercent, 'Example: 10'),
    );
}

function parseFeeInput(raw, label) {
  const cleaned = String(raw ?? '').trim().replace(/[$,\s]/g, '');
  const value = parseAmount(cleaned);
  if (value === null || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a valid amount. You can use numbers or K/M/B/T, such as 50K, 2.5M, or 1B.`);
  }
  return value;
}

function parsePercentInput(raw) {
  const cleaned = String(raw ?? '').trim().replace(/[%\s]/g, '');
  const value = parseAmount(cleaned);
  if (value === null || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error('Other service fee must be between 0% and 100%.');
  }
  return value;
}

export default {
  name: 'middleman_update_page',
  async execute(interaction, client) {
    try {
      const spawnerFee = parseFeeInput(
        interaction.fields.getTextInputValue('spawner_fee'),
        'Standard spawner fee',
      );
      const bulkSpawnerFee = parseFeeInput(
        interaction.fields.getTextInputValue('bulk_spawner_fee'),
        '64+ spawner fee',
      );
      const otherServicePercent = parsePercentInput(
        interaction.fields.getTextInputValue('other_service_percent'),
      );

      const current = loadMiddlemanFees();
      const fees = {
        ...current,
        spawnerFee,
        bulkSpawnerFee,
        bulkThreshold: 64,
        otherServicePercent,
      };

      saveMiddlemanFees(fees);
      const message = buildMiddlemanServiceMessage(fees);
      persistMiddlemanMessage(message);
      await postMiddlemanMessage(client, message);

      await interaction.reply({
        content: `✅ **Middleman fees updated and reposted in <#1519838464374476991>.**\n\n**Standard:** ${formatResult(spawnerFee)} per spawner\n**64+:** ${formatResult(bulkSpawnerFee)} per spawner\n**Other services:** ${formatResult(otherServicePercent)}%`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      await interaction.reply({
        content: `⚠️ **Middleman update failed:** ${error?.message || 'Unknown error.'}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
