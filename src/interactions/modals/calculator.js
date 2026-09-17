import { MessageFlags } from 'discord.js';
import { calculateValues, formatResult, parseAmount, parseOperation } from '../../utils/calculator.js';

export default {
  name: 'calculate_modal',
  async execute(interaction) {
    const raw1 = interaction.fields.getTextInputValue('calc_value1');
    const rawOp = interaction.fields.getTextInputValue('calc_operation');
    const raw2 = interaction.fields.getTextInputValue('calc_value2');

    const value1 = parseAmount(raw1);
    const value2 = parseAmount(raw2);
    const operation = parseOperation(rawOp);

    if (value1 === null || value2 === null || operation === null) {
      return interaction.reply({
        content: '❌ Couldn\'t read that. Use numbers like `5k`, `2.5m`, `1b`, `1t`, or decimals like `.5`, with an operation such as `+ - × /`.',
        flags: MessageFlags.Ephemeral,
      });
    }

    let result;
    try {
      result = calculateValues(value1, operation, value2);
    } catch (error) {
      return interaction.reply({
        content: `❌ ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!Number.isFinite(result)) {
      return interaction.reply({
        content: '❌ The result is too large or otherwise not a finite number.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const exact = result.toLocaleString('en-US', { maximumFractionDigits: 12 });
    return interaction.reply({
      content: `🧮 **${formatResult(value1)} ${operation} ${formatResult(value2)} = ${formatResult(result)}**\nExact: \`${exact}\``,
      flags: MessageFlags.Ephemeral,
    });
  },
};
