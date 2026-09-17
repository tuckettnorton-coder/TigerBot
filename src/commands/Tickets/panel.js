import {
  ActionRowBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';
import { ensureTicketInfrastructure } from '../../services/ticketService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Manage the TigerBot ticket panel')
    .setDMPermission(false)
    .addSubcommand((sub) => sub.setName('post').setDescription('Post the Tiger Market ticket selection panel')),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server to post the ticket panel.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await ensureTicketInfrastructure(interaction.guild);

      const menu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select')
        .setPlaceholder('Select what you need help with')
        .addOptions(
          Object.entries(TICKET_TYPES).map(([value, ticket]) => ({
            value,
            label: ticket.label,
            description: ticket.description.slice(0, 100),
            emoji: ticket.emoji,
          })),
        );

      const ticketList = Object.values(TICKET_TYPES)
        .map((ticket) => `${ticket.emoji} **${ticket.label}**`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle('Support for')
        .setDescription(
          `Select the type of support you need from the dropdown below.\n\n${ticketList}`,
        )
        .setFooter({ text: 'Tiger Market Support • Select a category to open a ticket' });

      await interaction.channel.send({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(menu)],
      });

      await interaction.editReply('✅ Ticket panel posted. All required ticket categories and private ticket log/transcript channels were checked automatically.');
    } catch (error) {
      await interaction.editReply(`❌ I could not set up the ticket system automatically: ${error.message}`).catch(() => {});
    }
  },
};
