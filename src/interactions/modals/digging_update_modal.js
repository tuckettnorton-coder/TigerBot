import {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import {
  loadDiggingPrices,
  persistDiggingPrices,
  postDiggingPrices,
} from '../../commands/Utility/digging-update.js';

export function buildDiggingPriceModal(data = loadDiggingPrices()) {
  const modal = new ModalBuilder()
    .setCustomId('digging_price_page')
    .setTitle('Update Digging Prices');

  const prices = data.prices || {};

  const priceInput = new TextInputBuilder()
    .setCustomId('prices')
    .setLabel('Digging Prices')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue([
      `Per block: ${prices.perBlock ?? '$1000'}`,
      `Good coords: ${prices.goodCoords ?? '20M'}`,
      `Custom region: ${prices.customRegion ?? '10M'}`,
    ].join('\n'))
    .setPlaceholder('Per block: $1000\nGood coords: 20M\nCustom region: 10M');

  const notesInput = new TextInputBuilder()
    .setCustomId('notes')
    .setLabel('Additional Notes')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue(data.notes || '')
    .setPlaceholder('Enter the additional notes.');

  const refundInput = new TextInputBuilder()
    .setCustomId('refund')
    .setLabel('Refund Policy')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue(data.refundPolicy || '')
    .setPlaceholder('Enter the refund policy.');

  const ticketInput = new TextInputBuilder()
    .setCustomId('ticket')
    .setLabel('Ticket / Buy Instruction')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue('Make a `Digging Service` <#1504949441650622575>  To Buy <@&1528495941328441456>')
    .setPlaceholder('Example: Make a `Digging Service` #ticket To Buy @Builder');

  modal.addComponents(
    new ActionRowBuilder().addComponents(priceInput),
    new ActionRowBuilder().addComponents(notesInput),
    new ActionRowBuilder().addComponents(refundInput),
    new ActionRowBuilder().addComponents(ticketInput),
  );

  return modal;
}

function parsePriceLines(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length !== 3) {
    throw new Error('Digging Prices must contain exactly 3 lines: Per block, Good coords, Custom region.');
  }

  const prices = {};
  const keys = ['perBlock', 'goodCoords', 'customRegion'];

  for (let i = 0; i < keys.length; i += 1) {
    const colon = lines[i].indexOf(':');
    if (colon === -1 || !lines[i].slice(colon + 1).trim()) {
      throw new Error(`Invalid Digging Prices line ${i + 1}. Use "Label: Price".`);
    }
    prices[keys[i]] = lines[i].slice(colon + 1).trim();
  }

  return prices;
}

export default {
  name: 'digging_price_page',

  async execute(interaction, client) {
    try {
      const prices = parsePriceLines(interaction.fields.getTextInputValue('prices'));
      const notes = interaction.fields.getTextInputValue('notes').trim();
      const refundPolicy = interaction.fields.getTextInputValue('refund').trim();
      const ticket = interaction.fields.getTextInputValue('ticket').trim();

      if (!notes) throw new Error('Additional Notes cannot be empty.');
      if (!refundPolicy) throw new Error('Refund Policy cannot be empty.');
      if (!ticket) throw new Error('Ticket / Buy Instruction cannot be empty.');

      const data = { prices, notes, refundPolicy, ticket };
      persistDiggingPrices(data);
      await postDiggingPrices(client, data);

      await interaction.reply({
        content: '✅ **Digging prices and service information have been updated and posted.**',
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      await interaction.reply({
        content: `⚠️ **Digging price update failed:** ${error?.message || 'Unknown error.'}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
