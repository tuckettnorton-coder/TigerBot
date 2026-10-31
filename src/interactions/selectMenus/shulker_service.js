import {
  ActionRowBuilder, FileUploadBuilder, LabelBuilder, ModalBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} from 'discord.js';
import { getShulkerDraft, patchShulkerDraft } from '../../utils/shulkerDrafts.js';
import { ticketCancelRow } from '../../utils/ticketEphemeral.js';

function selectionRow(step, sessionId, placeholder, choices) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`shulker_service:${step}:${sessionId}`)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(choices.map(([label, value]) =>
      new StringSelectMenuOptionBuilder().setLabel(label).setValue(value)));
  return new ActionRowBuilder().addComponents(menu);
}

export function primaryShulkerRow(sessionId) {
  return selectionRow('primary', sessionId, 'Select one: Inventory or Hotbar', [
    ['Inventory', 'inventory'],
    ['Hotbar', 'hotbar'],
  ]);
}

function yesNoRow(step, sessionId, question) {
  return selectionRow(step, sessionId, question, [
    ['Yes', 'yes'],
    ['No', 'no'],
  ]);
}

export function buildShulkerUploadModal(draft) {
  const hotbarUpload = new FileUploadBuilder()
    .setCustomId('hotbar_image')
    .setMinValues(draft.includeHotbar ? 1 : 0)
    .setMaxValues(1)
    .setRequired(draft.includeHotbar);
  const inventoryUpload = new FileUploadBuilder()
    .setCustomId('inventory_image')
    .setMinValues(draft.includeInventory ? 1 : 0)
    .setMaxValues(1)
    .setRequired(draft.includeInventory);

  return new ModalBuilder()
    .setCustomId(`shulker_service_upload:${draft.sessionId}`)
    .setTitle('Shulker Service Screenshots')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Upload Hotbar Image Here')
        .setDescription(draft.includeHotbar ? 'Required: screenshot of your hotbar' : 'Optional: screenshot of your hotbar')
        .setFileUploadComponent(hotbarUpload),
      new LabelBuilder()
        .setLabel('Upload Inventory Image Here')
        .setDescription(draft.includeInventory ? 'Required: screenshot of your inventory' : 'Optional: screenshot of your inventory')
        .setFileUploadComponent(inventoryUpload),
    );
}

export default {
  name: 'shulker_service',
  async execute(interaction, client, args = []) {
    const [step, sessionId] = args;
    const draft = getShulkerDraft(interaction.guildId, interaction.user.id, sessionId);
    if (!draft) {
      return interaction.reply({ content: '❌ This Shulker Service form expired. Please open a new ticket form.', ephemeral: true });
    }

    if (step === 'primary') {
      const primary = interaction.values?.[0];
      if (!['inventory', 'hotbar'].includes(primary)) {
        return interaction.reply({ content: '❌ Select Inventory or Hotbar.', ephemeral: true });
      }
      patchShulkerDraft(interaction.guildId, interaction.user.id, sessionId, {
        primary,
        includeInventory: primary === 'inventory',
        includeHotbar: primary === 'hotbar',
      });
      const other = primary === 'inventory' ? 'hotbar' : 'inventory';
      return interaction.update({
        content: `### 📦 Shulker Service\n**First choice:** ${primary === 'inventory' ? 'Inventory' : 'Hotbar'}\n**Do you want ${other} as well?**`,
        components: [yesNoRow('extra', sessionId, `Do you want ${other}?`), ticketCancelRow()],
      });
    }

    if (step === 'extra') {
      const answer = interaction.values?.[0];
      if (!draft.primary || !['yes', 'no'].includes(answer)) {
        return interaction.reply({ content: '❌ Please select your first choice again.', ephemeral: true });
      }
      const extra = answer === 'yes';
      patchShulkerDraft(interaction.guildId, interaction.user.id, sessionId, {
        includeInventory: draft.primary === 'inventory' || (draft.primary === 'hotbar' && extra),
        includeHotbar: draft.primary === 'hotbar' || (draft.primary === 'inventory' && extra),
      });
      return interaction.update({
        content: '### 📸 Screenshot Reminder\n**Have you taken screenshots of your selected inventory/hotbar?**\nPlease take clear screenshots before continuing; you will upload them in the next step.',
        components: [yesNoRow('reminder', sessionId, 'Have you taken the screenshots?'), ticketCancelRow()],
      });
    }

    if (step === 'reminder') {
      const answer = interaction.values?.[0];
      if (!draft.primary || !['yes', 'no'].includes(answer)) {
        return interaction.reply({ content: '❌ Invalid screenshot confirmation.', ephemeral: true });
      }
      if (answer === 'no') {
        return interaction.update({
          content: '📸 Take your screenshots first, then select **Yes** when you are ready to upload them.',
          components: [yesNoRow('reminder', sessionId, 'Ready to upload screenshots?'), ticketCancelRow()],
        });
      }
      return interaction.showModal(buildShulkerUploadModal(draft));
    }

    return interaction.reply({ content: '❌ This Shulker Service step is unavailable.', ephemeral: true });
  },
};
