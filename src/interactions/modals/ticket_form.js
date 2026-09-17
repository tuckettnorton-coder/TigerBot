import { createTicketChannel, logTicket } from '../../services/ticketService.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';

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

      const answers = Object.fromEntries(
        ticket.form.map((field) => [field.id, interaction.fields.getTextInputValue(field.id)]),
      );

      // Buying/Selling Spawners requires a minimum of 3 spawners.
      // Validate this before creating the ticket so amounts like 1 or 2 are rejected.
      if (typeId === 'buying_selling_spawners') {
        const rawAmount = String(answers.amount ?? '').trim();
        const amount = Number(rawAmount.replace(/,/g, ''));

        if (!/^\d+(?:\.\d+)?$/.test(rawAmount) || !Number.isFinite(amount) || amount < 3) {
          await interaction.reply({
            content: '❌ **Minimum is 3 spawners.** Please enter an amount of **3 or more**.',
            ephemeral: true,
          });
          return;
        }
      }

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
