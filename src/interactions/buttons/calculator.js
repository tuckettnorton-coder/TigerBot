import { buildCalculatorModal } from '../../utils/calculator.js';

export default {
  name: 'calculate_ticket',
  async execute(interaction) {
    await interaction.showModal(buildCalculatorModal());
  },
};
