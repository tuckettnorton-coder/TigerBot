import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
  ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { getShulkerDraft, patchShulkerDraft } from '../../utils/shulkerDrafts.js';
import { getShulkerUploadOrder } from '../selectMenus/shulker_service.js';
import { registerTicketEphemeral, ticketCancelRow } from '../../utils/ticketEphemeral.js';

export function parseShulkerQuantity(raw) {
  const value = String(raw ?? '').trim();
  if (!/^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)$/.test(value)) return null;
  const number = Number(value.replaceAll(',', ''));
  return Number.isSafeInteger(number) && number >= 27 ? number : null;
}

export function buildShulkerAmountsModal(draft) {
  const kinds = getShulkerUploadOrder(draft);
  if (!kinds.length) throw new Error('Choose Inventory or Hotbar first.');
  const modal = new ModalBuilder()
    .setCustomId(`shulker_service_quantity:${draft.sessionId}`)
    .setTitle('Shulker Service Amounts');

  for (const kind of kinds) {
    const name = kind === 'inventory' ? 'Inventory' : 'Hotbar';
    const field = new TextInputBuilder()
      .setCustomId(`${kind}_amount`)
      .setLabel(`${name} Amount (minimum 27)`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('27 or more')
      .setRequired(true)
      .setMaxLength(15);
    const saved = kind === 'inventory' ? draft.inventoryAmount : draft.hotbarAmount;
    if (Number.isSafeInteger(saved) && saved >= 27) field.setValue(String(saved));
    modal.addComponents(new ActionRowBuilder().addComponents(field));
  }
  return modal;
}

export default {
  name: 'shulker_service_quantity',
  async execute(interaction, client, args = []) {
    const sessionId = args[0];
    const draft = getShulkerDraft(interaction.guildId, interaction.user.id, sessionId);
    if (!draft || draft.completing || Object.keys(draft.screenshots || {}).length) {
      return interaction.reply({
        content: '❌ The Shulker Service form has expired or the screenshots have already been submitted.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const kinds = getShulkerUploadOrder(draft);
    if (!kinds.length) {
      return interaction.reply({ content: '❌ Please select Inventory or Hotbar first.', flags: MessageFlags.Ephemeral });
    }
    const amounts = {};
    for (const kind of kinds) {
      const count = parseShulkerQuantity(interaction.fields.getTextInputValue(`${kind}_amount`));
      if (count === null) {
        const name = kind === 'inventory' ? 'Inventory' : 'Hotbar';
        const response = {
          content: `❌ **${name} amount must be a whole number of at least 27.** Click below to correct it.`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`shulker_service_amounts:${sessionId}`)
                .setLabel('Correct Amounts')
                .setStyle(ButtonStyle.Primary),
            ),
            ticketCancelRow(),
          ],
          flags: MessageFlags.Ephemeral,
        };
        await interaction.reply(response);
        registerTicketEphemeral(interaction.user.id, interaction);
        return;
      }
      amounts[kind === 'inventory' ? 'inventoryAmount' : 'hotbarAmount'] = count;
    }

    patchShulkerDraft(interaction.guildId, interaction.user.id, sessionId, {
      inventoryAmount: null,
      hotbarAmount: null,
      ...amounts,
      amountsComplete: true,
    });

    const summary = kinds.map(kind =>
      `**${kind === 'inventory' ? 'Inventory' : 'Hotbar'}:** ${amounts[kind === 'inventory' ? 'inventoryAmount' : 'hotbarAmount']} shulkers`).join('\n');
    await interaction.reply({
      content: `### 📸 Screenshot Reminder\n${summary}\n\n**Have you taken screenshots of your selected inventory/hotbar?**\nYou will upload each selected screenshot separately.`,
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`shulker_service:reminder:${sessionId}`)
            .setPlaceholder('Have you taken the screenshots?')
            .addOptions(
              { label: 'Yes', value: 'yes', emoji: '✅' },
              { label: 'No', value: 'no', emoji: '❌' },
            ),
        ),
        ticketCancelRow(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    registerTicketEphemeral(interaction.user.id, interaction);
  },
};
