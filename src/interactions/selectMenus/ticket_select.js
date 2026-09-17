import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';
import { createTicketChannel, logTicket, findExistingTicket } from '../../services/ticketService.js';

function buildSpawnerTradeMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('spawner_trade_type')
      .setPlaceholder('Select Buy or Sell...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Buy').setDescription('I want to buy spawners').setValue('buy').setEmoji('💰'),
        new StringSelectMenuOptionBuilder().setLabel('Sell').setDescription('I want to sell spawners').setValue('sell').setEmoji('💵'),
      ),
  );
}

export default {
  name: 'ticket_select',
  async execute(interaction) {
    try {
      const typeId = interaction.values?.[0];
      const ticket = TICKET_TYPES[typeId];
      if (!ticket) {
        await interaction.reply({ content: 'That ticket type is unavailable.', ephemeral: true });
        return;
      }

      const existing = await findExistingTicket(interaction.guild, interaction.user.id, ticket.categoryName);
      if (existing) {
        await interaction.reply({ content: `You already have an open ${ticket.label} ticket: ${existing}`, ephemeral: true });
        return;
      }

      // Spawner tickets use click-only Buy/Sell and spawner-type dropdowns.
      if (typeId === 'buying_selling_spawners') {
        await interaction.reply({
          content: '### 💸 Buying/Selling Spawners\nFirst, select whether you want to **Buy** or **Sell**.',
          components: [buildSpawnerTradeMenu()],
          ephemeral: true,
        });
        return;
      }

      if (!ticket.form?.length) {
        await interaction.deferReply({ ephemeral: true });
        const result = await createTicketChannel({ guild: interaction.guild, user: interaction.user, typeId });
        if (result.existing) return interaction.editReply(`You already have an open ticket: ${result.existing}`);
        const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
        await logTicket(interaction.guild, `🎫 **Ticket opened** • ${ticket.label} • ${displayName} • ${result.channel}`);
        await interaction.editReply(`✅ Ticket created: ${result.channel}`);
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`ticket_form:${typeId}`)
        .setTitle(ticket.label.slice(0, 45));

      for (const field of ticket.form.slice(0, 5)) {
        const input = new TextInputBuilder()
          .setCustomId(field.id)
          .setLabel(field.label.slice(0, 45))
          .setStyle(field.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(field.required !== false);
        if (field.placeholder) input.setPlaceholder(field.placeholder.slice(0, 100));
        modal.addComponents(new ActionRowBuilder().addComponents(input));
      }

      await interaction.showModal(modal);
    } catch (error) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`❌ Could not open the ticket: ${error.message}`).catch(() => {});
      } else {
        await interaction.reply({ content: `❌ Could not open the ticket: ${error.message}`, ephemeral: true }).catch(() => {});
      }
    }
  },
};
