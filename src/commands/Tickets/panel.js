import { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { TICKET_TYPES } from '../../config/ticketTypes.js';

export default {
  data: new (await import('discord.js')).SlashCommandBuilder()
    .setName('panel')
    .setDescription('Manage the TigerBot ticket panel')
    .addSubcommand(sub => sub.setName('post').setDescription('Post the ticket selection panel')),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.reply({ content: 'You need Manage Server to post the ticket panel.', ephemeral: true });
      return;
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_select')
      .setPlaceholder('Make a selection')
      .addOptions(Object.entries(TICKET_TYPES).map(([value, ticket]) => ({
        value,
        label: ticket.label,
        description: ticket.description.slice(0, 100),
        emoji: ticket.emoji,
      })));

    const embed = new EmbedBuilder()
      .setTitle('Make a selection')
      .setDescription('Please select the type of ticket you would like to open from the menu below.')
      .setFooter({ text: 'Tiger Market Support' });

    await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    await interaction.reply({ content: 'Ticket panel posted.', ephemeral: true });
  },
};
