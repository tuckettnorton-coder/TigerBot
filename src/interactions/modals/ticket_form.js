import { EmbedBuilder } from 'discord.js';
import { createTicketChannel, logTicket } from '../../services/ticketService.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';
import { calculateSpawnerPrice, buildSpawnerCalculationMessage } from '../../utils/spawnerPricing.js';
import { calculateDiggingPrice, buildDiggingCalculationMessage } from '../../utils/diggingPricing.js';
import { parseAmount } from '../../utils/calculator.js';

const NUMBER_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALE_WORDS = { hundred: 100, thousand: 1_000, million: 1_000_000, billion: 1_000_000_000 };

function parseNumberWord(value) {
  const normalized = String(value ?? '').toLowerCase().trim().replace(/[-,]/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return null;
  const cleaned = normalized.replace(/\bspawners?\b/g, '').replace(/\b(?:items?|pcs?|pieces?)\b/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned || !/^[a-z ]+$/.test(cleaned)) return null;
  const words = cleaned.split(' '); let total = 0; let current = 0; let sawNumber = false;
  for (const word of words) {
    if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, word)) { current += NUMBER_WORDS[word]; sawNumber = true; continue; }
    if (word === 'hundred') { if (!sawNumber || current === 0) return null; current *= 100; continue; }
    if (Object.prototype.hasOwnProperty.call(SCALE_WORDS, word)) { if (!sawNumber || current === 0) return null; total += current * SCALE_WORDS[word]; current = 0; sawNumber = false; continue; }
    if (word === 'and') continue;
    return null;
  }
  return total + current || null;
}

function parseSpawnerAmount(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  const cleaned = raw.replace(/\bspawners?\b/g, '').replace(/\s+/g, '').replace(/,/g, '');
  return parseAmount(cleaned) ?? parseNumberWord(raw);
}

async function addCalculationToPanel(channel, ticketLabel, name, text) {
  const messages = await channel.messages.fetch({ limit: 20 });
  const panelMessage = messages.find((message) => message.embeds?.some((embed) => embed.title === ticketLabel));
  if (!panelMessage?.embeds?.[0]) throw new Error('Could not find the ticket panel message to add the calculation.');
  const panelEmbed = EmbedBuilder.from(panelMessage.embeds[0]);
  panelEmbed.addFields({ name, value: text.slice(0, 1024), inline: false });
  await panelMessage.edit({ embeds: [panelEmbed] });
}

const REGION_LABELS = { west: 'West', east: 'East', ocean: 'Ocean', asia: 'Asia', europe: 'Europe', none: 'None' };

export default {
  name: 'ticket_form',
  async execute(interaction, client, args) {
    try {
      const typeId = args?.[0];
      const ticket = TICKET_TYPES[typeId];
      if (!ticket) return interaction.reply({ content: 'That ticket type is unavailable.', ephemeral: true });

      if (typeId === 'buying_selling_spawners') {
        const trade = args?.[1];
        const spawnerType = args?.[2];
        const selectedAmount = args?.[3];
        if (!['buy', 'sell'].includes(trade) || !['skeleton', 'creeper', 'irongolem'].includes(spawnerType)) {
          return interaction.reply({ content: '❌ Invalid spawner ticket selection.', ephemeral: true });
        }
        const amountDisplay = selectedAmount === 'custom' ? interaction.fields.getTextInputValue('amount').trim() : (selectedAmount || interaction.fields.getTextInputValue('amount').trim());
        const amount = parseSpawnerAmount(amountDisplay);
        const answers = { ign: interaction.fields.getTextInputValue('ign').trim(), buy_or_sell: trade, amount: amountDisplay, spawner_type: spawnerType };
        if (!answers.ign) return interaction.reply({ content: '❌ Please enter your IGN.', ephemeral: true });
        if (amount === null || !Number.isFinite(amount) || amount < 3 || !Number.isInteger(amount)) return interaction.reply({ content: '❌ **Minimum is 3 spawners.** Please choose a valid whole-number amount of **3 or more**.', ephemeral: true });
        const calculation = calculateSpawnerPrice({ trade, spawnerType, amount });
        await interaction.deferReply({ ephemeral: true });
        const result = await createTicketChannel({ guild: interaction.guild, user: interaction.user, typeId, answers });
        if (result.existing) return interaction.editReply(`You already have an open ticket: ${result.existing}`);
        await addCalculationToPanel(result.channel, ticket.label, '🧮 Automatic Spawner Price Calculation', buildSpawnerCalculationMessage(calculation));
        const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
        await logTicket(interaction.guild, `🎫 **Ticket opened** • ${ticket.label} • ${displayName} • ${result.channel}`);
        return interaction.editReply(`✅ Ticket created: ${result.channel}\n💰 **Automatic total: ${calculation.totalFormatted}**`);
      }

      if (typeId === 'digging_services') {
        const area = args?.[1];
        const goodCoords = args?.[2];
        const region = args?.[3];
        if (!['yes', 'no'].includes(area) || !['yes', 'no'].includes(goodCoords) || !REGION_LABELS[region]) {
          return interaction.reply({ content: '❌ Invalid digging ticket selection.', ephemeral: true });
        }
        const areaSize = interaction.fields.getTextInputValue('area_size').trim();
        const areaLocation = interaction.fields.getTextInputValue('area_location').trim();
        const ign = interaction.fields.getTextInputValue('ign').trim();
        if (!areaSize || !areaLocation || !ign) return interaction.reply({ content: '❌ Please complete all digging service fields.', ephemeral: true });

        const calculation = calculateDiggingPrice({ areaSize, goodCoords: goodCoords === 'yes', customRegion: region !== 'none' });
        const answers = {
          area_size: areaSize,
          has_area: area === 'yes' ? 'Yes' : 'No',
          area_location: areaLocation,
          good_chords: goodCoords === 'yes' ? 'Yes' : 'No',
          region: region !== 'none' ? 'Yes' : 'No',
          region_name: REGION_LABELS[region],
          ign,
        };
        await interaction.deferReply({ ephemeral: true });
        const result = await createTicketChannel({ guild: interaction.guild, user: interaction.user, typeId, answers });
        if (result.existing) return interaction.editReply(`You already have an open ticket: ${result.existing}`);
        await addCalculationToPanel(result.channel, ticket.label, '🧮 Automatic Digging Price Calculation', buildDiggingCalculationMessage(calculation));
        const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
        await logTicket(interaction.guild, `🎫 **Ticket opened** • ${ticket.label} • ${displayName} • ${result.channel}`);
        return interaction.editReply(`✅ Ticket created: ${result.channel}\n💰 **Automatic total: ${calculation.totalFormatted}**`);
      }

      const answers = Object.fromEntries(ticket.form.map((field) => [field.id, interaction.fields.getTextInputValue(field.id)]));
      await interaction.deferReply({ ephemeral: true });
      const result = await createTicketChannel({ guild: interaction.guild, user: interaction.user, typeId, answers });
      if (result.existing) return interaction.editReply(`You already have an open ticket: ${result.existing}`);
      const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
      await logTicket(interaction.guild, `🎫 **Ticket opened** • ${ticket.label} • ${displayName} • ${result.channel}`);
      return interaction.editReply(`✅ Ticket created: ${result.channel}`);
    } catch (error) {
      if (interaction.deferred || interaction.replied) await interaction.editReply(`❌ Could not create the ticket: ${error.message}`).catch(() => {});
      else await interaction.reply({ content: `❌ Could not create the ticket: ${error.message}`, ephemeral: true }).catch(() => {});
    }
  },
};
