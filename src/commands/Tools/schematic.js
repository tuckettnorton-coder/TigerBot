import { ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { mkdir } from 'fs/promises';
import { addSchematic, listSchematics, MAX_OPTIONS } from '../../services/schematicService.js';

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
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('remove').setDescription('Remove a schematic from the library')
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: "❌ You don't have permission to manage schematics.", ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'panel') {
      const embed = new EmbedBuilder()
        .setTitle('📁 Schematic Selection Menu')
        .setDescription('**Choose a category below to browse available schematics.**');

      const button = new ButtonBuilder()
        .setCustomId('schematic_panel:browse')
        .setLabel('Browse Schematics')
        .setStyle(ButtonStyle.Primary);

      return interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(button)],
      });
    }

    if (subcommand === 'remove') {
      const entries = await listSchematics();

      if (!entries.length) {
        return interaction.reply({
          content: 'There are no schematics in the library to remove.',
          ephemeral: true,
        });
      }

      const options = entries.slice(-MAX_OPTIONS).reverse().map((entry) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(String(entry.title || entry.filename || 'Untitled schematic').slice(0, 100))
          .setDescription(String(entry.filename || 'Schematic file').slice(0, 100))
          .setValue(String(entry.id))
      );

      const menu = new StringSelectMenuBuilder()
        .setCustomId('schematic_remove_select')
        .setPlaceholder('Choose a schematic to remove...')
        .addOptions(options);

      return interaction.reply({
        content: 'Select the schematic you want to remove from the library. This removes it from the download panel.',
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true,
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
