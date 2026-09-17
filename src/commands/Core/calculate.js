import { SlashCommandBuilder } from 'discord.js';
import { buildCalculatorModal } from '../../utils/calculator.js';

export default {
  data: new SlashCommandBuilder()
    .setName('calculate')
    .setDescription('Open the K/M/B/T calculator'),

  async execute(interaction) {
    await interaction.showModal(buildCalculatorModal());
  },
};
