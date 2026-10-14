import {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { loadPrices, persistPrices, postPrices } from '../../commands/Utility/spawner-update.js';
import { logger } from '../../utils/logger.js';

const CONFIG = [
  { key: 'skeleton', label: 'Skeleton Prices' },
  { key: 'creeper', label: 'Creeper Prices' },
  { key: 'irongolem', label: 'Iron Golem Prices' },
];

const ORDER = ['buy3', 'buy64', 'sell3', 'sell64'];

// Discord interactions should only be processed once, even if the event is
// accidentally routed through more than one listener in the same process.
const processedSubmissions = new Map();
function claimSubmission(interactionId) {
  const now = Date.now();
  for (const [id, expiresAt] of processedSubmissions) {
    if (expiresAt <= now) processedSubmissions.delete(id);
  }
  if (processedSubmissions.has(interactionId)) return false;
  processedSubmissions.set(interactionId, now + 5 * 60 * 1000);
  return true;
}

export function buildSpawnerPriceModal(prices = loadPrices()) {
  const modal = new ModalBuilder()
    .setCustomId('spawner_price_page')
    .setTitle('Update Spawner Prices');

  for (const { key, label } of CONFIG) {
    const p = prices[key] || {};
    const value = [
      `3+ Buy: ${p.buy3 ?? ''}`,
      `64+ Buy: ${p.buy64 ?? ''}`,
      `3+ Sell: ${p.sell3 ?? ''}`,
      `64+ Sell: ${p.sell64 ?? ''}`,
    ].join('\n');

    const input = new TextInputBuilder()
      .setCustomId(key)
      .setLabel(label)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setValue(value)
      .setPlaceholder('3+ Buy: 9M\n64+ Buy: 8.9M\n3+ Sell: 7.5M\n64+ Sell: 7.6M');

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

function parsePrices(text, spawnerName) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length !== 4) {
    throw new Error(`${spawnerName} must contain exactly 4 lines: 3+ Buy, 64+ Buy, 3+ Sell, 64+ Sell.`);
  }

  const values = {};
  for (let i = 0; i < ORDER.length; i += 1) {
    const line = lines[i];
    const colon = line.indexOf(':');
    if (colon === -1 || !line.slice(colon + 1).trim()) {
      throw new Error(`Invalid ${spawnerName} line ${i + 1}. Use "Label: Price".`);
    }
    values[ORDER[i]] = line.slice(colon + 1).trim();
  }

  return values;
}

export default {
  name: 'spawner_price_page',

  async execute(interaction, client) {
    if (!claimSubmission(interaction.id)) {
      logger.warn(`Ignored duplicate spawner price modal delivery for interaction ${interaction.id}.`);
      return;
    }

    try {
      // Acknowledge before channel cleanup / message edits so Discord does not
      // time out the modal while duplicate posts are reconciled.
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const prices = loadPrices();
      for (const { key, label } of CONFIG) {
        const input = interaction.fields.getTextInputValue(key);
        prices[key] = parsePrices(input, label);
      }

      persistPrices(prices);
      await postPrices(client, prices);

      await interaction.editReply({
        content: '✅ **All 12 spawner prices have been updated.**',
      });
    } catch (error) {
      const response = {
        content: `⚠️ **Spawner price update failed:** ${error?.message || 'Unknown error.'}`,
      };

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(response);
        } else {
          await interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
        }
      } catch (responseError) {
        logger.warn('Could not send modal error response:', responseError?.message || responseError);
      }
    }
  },
};
