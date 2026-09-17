import { createTicketChannel, logTicket } from '../../services/ticketService.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const SCALE_WORDS = { hundred: 100, thousand: 1_000, million: 1_000_000, billion: 1_000_000_000 };

function parseNumberWord(value) {
  const normalized = String(value ?? '').toLowerCase().trim().replace(/[-,]/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return null;
  const cleaned = normalized.replace(/\bspawners?\b/g, '').replace(/\b(?:items?|pcs?|pieces?)\b/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned || !/^[a-z ]+$/.test(cleaned)) return null;

  const words = cleaned.split(' ');
  let total = 0;
  let current = 0;
  let sawNumber = false;

  for (const word of words) {
    if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, word)) {
      current += NUMBER_WORDS[word];
      sawNumber = true;
      continue;
    }
    if (word === 'hundred') {
      if (!sawNumber || current === 0) return null;
      current *= 100;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(SCALE_WORDS, word)) {
      if (!sawNumber || current === 0) return null;
      total += current * SCALE_WORDS[word];
      current = 0;
      sawNumber = false;
      continue;
    }
    if (word === 'and') continue;
    return null;
  }

  if (!sawNumber && current === 0 && total === 0) return null;
  return total + current;
}

function parseSpawnerAmount(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  const numericText = raw.replace(/,/g, '');
  if (/^\d+(?:\.\d+)?$/.test(numericText)) {
    const numeric = Number(numericText);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return parseNumberWord(raw);
}

export default {
  name: 'ticket_form',
  async execute(interaction, client, args) {
    try {
      const typeId = args?.[0];
      const ticket = TICKET_TYPES[typeId];
      if (!ticket) {
        await interaction.reply({ content: 'That ticket type is unavailable.', ephemeral: true });
        return;
      }

      // Special spawner flow: Buy/Sell and spawner type come from dropdowns, never typed.
      if (typeId === 'buying_selling_spawners') {
        const trade = args?.[1];
        const spawnerType = args?.[2];
        const validTrade = trade === 'buy' || trade === 'sell';
        const validSpawner = ['skeleton', 'creeper', 'irongolem'].includes(spawnerType);

        if (!validTrade || !validSpawner) {
          await interaction.reply({ content: '❌ Invalid spawner ticket selection.', ephemeral: true });
          return;
        }

        const answers = {
          ign: interaction.fields.getTextInputValue('ign').trim(),
          buy_or_sell: trade,
          amount: interaction.fields.getTextInputValue('amount').trim(),
          spawner_type: spawnerType,
        };

        const amount = parseSpawnerAmount(answers.amount);
        if (!answers.ign) {
          await interaction.reply({ content: '❌ Please enter your IGN.', ephemeral: true });
          return;
        }
        if (amount === null || !Number.isFinite(amount) || amount < 3) {
          await interaction.reply({
            content: '❌ **Minimum is 3 spawners.** Please enter an amount of **3 or more** (for example, `3`, `three`, or `three spawners`).',
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });
        const result = await createTicketChannel({ guild: interaction.guild, user: interaction.user, typeId, answers });
        if (result.existing) return interaction.editReply(`You already have an open ticket: ${result.existing}`);

        const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
        await logTicket(interaction.guild, `🎫 **Ticket opened** • ${ticket.label} • ${displayName} • ${result.channel}`);
        await interaction.editReply(`✅ Ticket created: ${result.channel}`);
        return;
      }

      const answers = Object.fromEntries(
        ticket.form.map((field) => [field.id, interaction.fields.getTextInputValue(field.id)]),
      );

      await interaction.deferReply({ ephemeral: true });
      const result = await createTicketChannel({ guild: interaction.guild, user: interaction.user, typeId, answers });
      if (result.existing) return interaction.editReply(`You already have an open ticket: ${result.existing}`);

      const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
      await logTicket(interaction.guild, `🎫 **Ticket opened** • ${ticket.label} • ${displayName} • ${result.channel}`);
      await interaction.editReply(`✅ Ticket created: ${result.channel}`);
    } catch (error) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`❌ Could not create the ticket: ${error.message}`).catch(() => {});
      } else {
        await interaction.reply({ content: `❌ Could not create the ticket: ${error.message}`, ephemeral: true }).catch(() => {});
      }
    }
  },
};
