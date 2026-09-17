import { EmbedBuilder } from 'discord.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';
import { createTicketChannel, logTicket } from '../../services/ticketService.js';
import { calculateMiddlemanSpawner, calculateMiddlemanOtherService, buildMiddlemanSpawnerCalculationMessage, buildMiddlemanOtherCalculationMessage } from '../../utils/middlemanPricing.js';
import { parseAmount } from '../../utils/calculator.js';
import { getMiddlemanDraft, clearMiddlemanDraft } from '../../utils/middlemanDrafts.js';
import { clearTicketEphemeral, clearTicketEphemeralLater } from '../../utils/ticketEphemeral.js';

async function addCalculationToPanel(channel, ticketLabel, name, text) {
  const messages = await channel.messages.fetch({ limit: 20 });
  const panelMessage = messages.find((message) => message.embeds?.some((embed) => embed.title === ticketLabel));
  if (!panelMessage?.embeds?.[0]) throw new Error('Could not find the ticket panel message to add the calculation.');
  const panelEmbed = EmbedBuilder.from(panelMessage.embeds[0]);
  panelEmbed.addFields({ name, value: text.slice(0, 1024), inline: false });
  await panelMessage.edit({ embeds: [panelEmbed] });
}

function parseSpawnerAmount(value) {
  const cleaned = String(value ?? '').trim().replace(/\s+/g, '').replace(/,/g, '');
  return parseAmount(cleaned);
}

export default {
  name: 'middleman_details',
  async execute(interaction) {
    try {
      const mode = interaction.customId.split(':')[1];
      const draft = getMiddlemanDraft(interaction.user.id);
      if (!draft?.yourIgn || !draft?.personIgn) {
        return interaction.reply({ content: '❌ Your Middleman ticket session expired. Please start the ticket again.', ephemeral: true });
      }

      let calculation;
      let answers;

      if (mode === 'spawner') {
        const amountRaw = interaction.fields.getTextInputValue('spawner_amount').trim();
        const amount = parseSpawnerAmount(amountRaw);
        if (amount === null || !Number.isInteger(amount) || amount < 1) {
          return interaction.reply({ content: '❌ Enter a valid whole-number amount, such as **3**, **64**, **128**, **1K**, or **2.5K**.', ephemeral: true });
        }
        if (!draft.spawnerType || !['buy', 'sell'].includes(draft.trade)) {
          return interaction.reply({ content: '❌ The spawner type or Buy/Sell selection is missing. Please start the ticket again.', ephemeral: true });
        }
        calculation = calculateMiddlemanSpawner({ trade: draft.trade, spawnerType: draft.spawnerType, amount });
        answers = {
          your_ign: draft.yourIgn,
          person_ign: draft.personIgn,
          spawners_involved: 'Yes',
          spawner_amount: amountRaw,
          spawner_type: calculation.spawnerLabel,
          buy_or_sell: draft.trade === 'buy' ? 'Buy' : 'Sell',
        };
      } else if (mode === 'other') {
        const valueRaw = interaction.fields.getTextInputValue('total_value').trim();
        const value = parseAmount(valueRaw);
        if (value === null || !Number.isFinite(value) || value < 0) {
          return interaction.reply({ content: '❌ Enter a valid value such as **100M**, **1.5B**, **250K**, or **2500000**.', ephemeral: true });
        }
        calculation = calculateMiddlemanOtherService(value);
        answers = {
          your_ign: draft.yourIgn,
          person_ign: draft.personIgn,
          spawners_involved: 'No',
          total_value: valueRaw,
        };
      } else {
        return interaction.reply({ content: '❌ Invalid Middleman form.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      const typeId = 'middleman';
      const ticket = TICKET_TYPES[typeId];
      const result = await createTicketChannel({ guild: interaction.guild, user: interaction.user, typeId, answers });
      if (result.existing) {
        clearMiddlemanDraft(interaction.user.id);
        await clearTicketEphemeral(interaction.user.id);
        return interaction.editReply(`You already have an open ticket: ${result.existing}`);
      }

      const calculationText = mode === 'spawner'
        ? buildMiddlemanSpawnerCalculationMessage(calculation)
        : buildMiddlemanOtherCalculationMessage(calculation);
      await addCalculationToPanel(result.channel, ticket.label, '🤝 Automatic Middleman Fee Calculation', calculationText);

      const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
      await logTicket(interaction.guild, `🎫 **Ticket opened** • ${ticket.label} • ${displayName} • ${result.channel}`);
      clearMiddlemanDraft(interaction.user.id);
      await clearTicketEphemeral(interaction.user.id);
      await interaction.editReply(`✅ Ticket created: ${result.channel}\n💰 **Middleman fee: ${calculation.middlemanFeeFormatted}**`);
      clearTicketEphemeralLater(interaction);
    } catch (error) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`❌ Could not create the Middleman ticket: ${error?.message || 'Unknown error.'}`).catch(() => {});
      } else {
        await interaction.reply({ content: `❌ Could not create the Middleman ticket: ${error?.message || 'Unknown error.'}`, ephemeral: true }).catch(() => {});
      }
    }
  },
};
