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

// The original selection determines the screenshot order. A user selecting
// only Inventory/Hotbar is never asked to upload the other image.
export function getShulkerUploadOrder(draft) {
  if (!draft || !['inventory', 'hotbar'].includes(draft.primary)) return [];
  const first = draft.primary;
  if ((first === 'inventory' && !draft.includeInventory)
      || (first === 'hotbar' && !draft.includeHotbar)) return [];
  const other = first === 'inventory' ? 'hotbar' : 'inventory';
  const includeOther = other === 'inventory' ? draft.includeInventory : draft.includeHotbar;
  return includeOther ? [first, other] : [first];
}

export function getNextShulkerUpload(draft) {
  return getShulkerUploadOrder(draft).find(kind => !draft.screenshots?.[kind]) || null;
}

export function buildShulkerUploadModal(draft, kind = getNextShulkerUpload(draft)) {
  if (!['inventory', 'hotbar'].includes(kind) || !getShulkerUploadOrder(draft).includes(kind)) {
    throw new Error('Invalid Shulker Service screenshot step.');
  }

  const label = kind === 'inventory' ? 'Inventory' : 'Hotbar';
  const upload = new FileUploadBuilder()
    .setCustomId(`${kind}_image`)
    .setMinValues(1)
    .setMaxValues(1)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(`shulker_service_upload:${draft.sessionId}:${kind}`)
    .setTitle(`Upload ${label} Screenshot`)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(`Upload ${label} Image Here`)
        .setDescription(`Upload one clear screenshot of your ${label.toLowerCase()}.`)
        .setFileUploadComponent(upload),
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
        screenshots: {},
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
        content: '### 📸 Screenshot Reminder\n**Have you taken screenshots of your selected inventory/hotbar?**\nPlease take clear screenshots before continuing; you will upload each selected screenshot separately.',
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
      const next = getNextShulkerUpload(draft);
      if (!next) {
        return interaction.reply({ content: '❌ Your screenshot form is no longer available. Start a new ticket form.', ephemeral: true });
      }
      return interaction.showModal(buildShulkerUploadModal(draft, next));
    }

    return interaction.reply({ content: '❌ This Shulker Service step is unavailable.', ephemeral: true });
  },
};
