import {
  ActionRowBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits,
  TextInputBuilder, TextInputStyle,
} from 'discord.js';
import {
  DEFAULT_SHULKER_FEES,
  postShulkerService,
} from '../../commands/Utility/shulker-update.js';

export function buildShulkerUpdateModal(fees = DEFAULT_SHULKER_FEES) {
  return new ModalBuilder()
    .setCustomId('shulker_update_modal')
    .setTitle('Update Shulker Service')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('service_fee')
          .setLabel('Service markup (%)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(6)
          .setValue(String(fees.serviceFeePercent)),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('refund_fee')
          .setLabel('Refund deduction (%)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(6)
          .setValue(String(fees.refundFeePercent)),
      ),
    );
}

function readPercent(raw, label) {
  const text = String(raw ?? '').trim().replace(/%$/, '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error(`${label} must be a number such as 10, 20, or 30.`);
  const value = Number(text);
  if (value < 0 || value > 100) throw new Error(`${label} must be between 0% and 100%.`);
  return value;
}

export default {
  name: 'shulker_update_modal',
  async execute(interaction, client) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '❌ Manage Server permission is required.', flags: MessageFlags.Ephemeral });
    }
    try {
      const fees = {
        serviceFeePercent: readPercent(interaction.fields.getTextInputValue('service_fee'), 'Service markup'),
        refundFeePercent: readPercent(interaction.fields.getTextInputValue('refund_fee'), 'Refund deduction'),
      };
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await postShulkerService(client, interaction.guildId, fees);
      await interaction.editReply({ content: `✅ Shulker Service updated. **Markup:** ${fees.serviceFeePercent}% • **Refund fee:** ${fees.refundFeePercent}%. The 1b example was updated automatically.` });
    } catch (error) {
      const payload = { content: `❌ Shulker Service update failed: ${error.message}` };
      if (interaction.deferred || interaction.replied) await interaction.editReply(payload).catch(() => {});
      else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  },
};
