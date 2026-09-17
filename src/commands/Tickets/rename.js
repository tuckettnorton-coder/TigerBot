import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getTicketFromChannel } from '../../services/ticketService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Rename the current ticket')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The new ticket name')
        .setRequired(true)
        .setMaxLength(90),
    )
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const ticket = getTicketFromChannel(interaction.channel);
      if (!ticket) {
        return interaction.reply({ content: '❌ This channel is not a managed ticket.', ephemeral: true });
      }

      const isAdmin = interaction.member.permissions?.has(PermissionFlagsBits.Administrator);
      const isStaff = interaction.channel.permissionsFor(interaction.member)?.has(PermissionFlagsBits.ManageChannels);
      if (!isAdmin && !isStaff) {
        return interaction.reply({ content: '❌ You need Manage Channels permission to rename tickets.', ephemeral: true });
      }

      const rawName = interaction.options.getString('name', true).trim();
      const cleanBaseName = rawName
        .toLowerCase()
        .replace(/[^a-z0-9-_ ]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      if (!cleanBaseName) {
        return interaction.reply({ content: '❌ Please provide a valid ticket name.', ephemeral: true });
      }

      const code = String(ticket.code || '').trim();
      const suffix = code ? `-${code}` : '';
      const maxBaseLength = Math.max(1, 90 - suffix.length);
      const cleanName = `${cleanBaseName.slice(0, maxBaseLength)}${suffix}`;

      await interaction.deferReply({ ephemeral: true });
      await interaction.channel.setName(cleanName, `Ticket renamed by ${interaction.user.tag}`);
      await interaction.editReply(`✅ Ticket renamed to **#${cleanName}**. The ticket code **${code || 'was preserved from the channel'}** was kept automatically.`);
    } catch (error) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`❌ ${error.message || 'Unable to rename this ticket.'}`).catch(() => {});
      } else {
        await interaction.reply({ content: `❌ ${error.message || 'Unable to rename this ticket.'}`, ephemeral: true }).catch(() => {});
      }
    }
  },
};
