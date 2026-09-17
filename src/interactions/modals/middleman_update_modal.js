import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { loadMiddlemanFees, saveMiddlemanFees, buildMiddlemanServiceMessage } from '../../utils/middlemanPricing.js';
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
      moneyInput('spawner_fee', 'Standard fee per spawner', fees.spawnerFee, 'Example: 50000'),
      moneyInput('bulk_spawner_fee', '64+ fee per spawner', fees.bulkSpawnerFee, 'Example: 25000'),
      moneyInput('other_service_percent', 'Other service fee %', fees.otherServicePercent, 'Example: 10'),
    );
}

export default {
  name: 'middleman_update_page',
  async execute(interaction, client) {
    try {
      const spawnerFee = Number(interaction.fields.getTextInputValue('spawner_fee').replace(/[$,\s]/g, ''));
      const bulkSpawnerFee = Number(interaction.fields.getTextInputValue('bulk_spawner_fee').replace(/[$,\s]/g, ''));
      const otherServicePercent = Number(interaction.fields.getTextInputValue('other_service_percent').replace('%', '').trim());

      if (!Number.isFinite(spawnerFee) || spawnerFee < 0) throw new Error('Standard spawner fee must be a valid number.');
      if (!Number.isFinite(bulkSpawnerFee) || bulkSpawnerFee < 0) throw new Error('64+ spawner fee must be a valid number.');
      if (!Number.isFinite(otherServicePercent) || otherServicePercent < 0 || otherServicePercent > 100) {
        throw new Error('Other service fee must be between 0% and 100%.');
      }

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
        content: `✅ **Middleman fees updated and reposted in <#1519838464374476991>.**\n\n**Standard:** ${spawnerFee.toLocaleString()} per spawner\n**64+:** ${bulkSpawnerFee.toLocaleString()} per spawner\n**Other services:** ${otherServicePercent}%`,
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
