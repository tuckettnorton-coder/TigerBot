import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig } from '../../services/config/guildConfig.js';
import { getTranscriptForMessage } from '../../services/transcriptStore.js';
import ticketDashboard from './modules/ticket_dashboard.js';

function isStaff(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

async function findTranscriptMessage(interaction, id) {
  const guildConfig = await getGuildConfig(interaction.client, interaction.guild.id);
  const channelId = guildConfig.ticketTranscriptChannelId;

  if (!channelId) return null;

  const transcriptChannel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (!transcriptChannel?.isTextBased()) return null;

  let before;
  while (true) {
    const batch = await transcriptChannel.messages.fetch({
      limit: 100,
      ...(before ? { before } : {}),
    }).catch(() => null);

    if (!batch?.size) break;

    const match = batch.find((message) => {
      if (!message.embeds?.length) return false;
      return message.embeds.some((embed) =>
        embed.fields?.some((field) => field.name === 'ID' && String(field.value).includes(String(id)))
      );
    });

    if (match) return match;

    before = batch.last()?.id;
    if (batch.size < 100 || !before) break;
  }

  return null;
}

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage and look up tickets')
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('Open the ticket system dashboard')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('id')
        .setDescription('Find a ticket transcript by ticket ID or transcript message ID')
        .addStringOption((option) =>
          option
            .setName('id')
            .setDescription('Ticket channel ID or transcript message ID')
            .setRequired(true)
        )
    ),

  async execute(interaction, config, client) {
    if (!isStaff(interaction)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup') {
      return ticketDashboard.execute(interaction, config, client);
    }

    if (subcommand === 'id') {
      const id = interaction.options.getString('id', true).trim();

      const transcript = await getTranscriptForMessage(id);
      if (transcript) {
        const guildConfig = await getGuildConfig(client, interaction.guild.id);
        const transcriptChannel = guildConfig.ticketTranscriptChannelId
          ? await interaction.guild.channels.fetch(guildConfig.ticketTranscriptChannelId).catch(() => null)
          : null;

        const message = transcriptChannel?.isTextBased()
          ? await transcriptChannel.messages.fetch(id).catch(() => null)
          : null;

        if (message) {
          return interaction.reply({
            content: '📜 **Transcript found!**\n[Open Transcript Message](' + message.url + ')',
            flags: MessageFlags.Ephemeral,
          });
        }

        return interaction.reply({
          content: '📜 **Transcript found**, but the original transcript message could not be fetched. The stored transcript is still saved.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const message = await findTranscriptMessage(interaction, id);

      if (!message) {
        return interaction.reply({
          content: '❌ No transcript was found for ID \`' + id + '\`.',
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: '📜 **Transcript found!**\n[Open Transcript Message](' + message.url + ')',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
