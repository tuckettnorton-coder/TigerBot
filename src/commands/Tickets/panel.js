import {
  ActionRowBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';
import { ensureTicketInfrastructure } from '../../services/ticketService.js';
import { publicPanel } from '../Community/modules/tigerApplications.js';

const TICKET_PANEL_DESCRIPTION = [
  '**Staff members will never contact you via direct messages to trade spawners.**',
  '',
  '📋 **Ticket Rules**',
  '• No troll tickets or unnecessary pings to staff.',
  '• Ask your question clearly and right away.',
  '• Check <#1504948495948452001> <#1513625068239065158> <#1513625388503535657> <#1513629563337441321>',
  '  <#1519838464374476991> <#1525901034747330693> <#1545124171502329916> <#1513947221815590932> before opening a ticket.',
  '• Tickets inactive for 1+ days will be closed.',
  '• Fake giveaway claims or trolling will result in a timeout.',
  '• Staff will never DM you — all responses stay in the ticket.',
  '',
  '⏳ **A staff member will get to you shortly.**',
].join('\n');

export default {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Manage the TigerBot ticket panel')
    .setDMPermission(false)
    .addSubcommand((sub) => sub.setName('post').setDescription('Post the Tiger Market ticket selection panel'))
    .addSubcommand((sub) => sub.setName('staff').setDescription('Post the Staff application panel'))
    .addSubcommand((sub) => sub.setName('pm').setDescription('Post the Partner Manager application panel'))
    .addSubcommand((sub) => sub.setName('builder').setDescription('Post the Builder/Digger application panel')),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server to post the ticket panel.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand !== 'post') {
      await interaction.reply({ ...publicPanel(subcommand), ephemeral: false });
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

      const embed = new EmbedBuilder()
        .setTitle('🎫 Tiger Market Support')
        .setDescription(TICKET_PANEL_DESCRIPTION)
        .setFooter({ text: 'Tiger Market Support • Select a category below to open a ticket' });

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
