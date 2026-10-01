import { ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, SlashCommandBuilder } from 'discord.js';
import { mkdir } from 'fs/promises';
import { addSchematic } from '../../services/schematicService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('schematic')
    .setDescription('Manage the schematic library')
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand.setName('panel').setDescription('Post the schematic download panel')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('upload')
        .setDescription('Upload a schematic to the library')
        .addStringOption((option) =>
          option.setName('title').setDescription('Name shown in the schematic dropdown').setRequired(true)
        )
        .addAttachmentOption((option) =>
          option.setName('file').setDescription('The schematic file').setRequired(true)
        )
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: "❌ You don't have permission to manage schematics.", ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'panel') {
      const embed = new EmbedBuilder()
        .setTitle('Schematics')
        .setDescription('Click below to browse and download schematics.');

      const button = new ButtonBuilder()
        .setCustomId('schematic_panel:browse')
        .setLabel('Browse Schematics')
        .setStyle(ButtonStyle.Primary);

      return interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(button)],
      });
    }

    const title = interaction.options.getString('title', true).trim();
    const file = interaction.options.getAttachment('file', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      await mkdir('schematic_data/files', { recursive: true });
      const response = await fetch(file.url);
      if (!response.ok) throw new Error('Failed to download the uploaded attachment.');

      const buffer = Buffer.from(await response.arrayBuffer());
      const entry = await addSchematic({
        title,
        filename: file.name,
        buffer,
        uploadedBy: interaction.user.id,
      });

      return interaction.editReply('✅ Added **' + entry.title + '** to the schematic panel.');
    } catch (error) {
      return interaction.editReply('❌ Failed to save the schematic: ' + error.message);
    }
  },
};
