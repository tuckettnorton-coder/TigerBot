import {
  ModalBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { loadPrices, mergePrices } from '../../commands/Utility/spawner-update.js';
import { getLatestUpdateDataFast } from '../../utils/updateState.js';
import { logger } from '../../utils/logger.js';

const CONFIG = [
  { key: 'skeleton', label: 'Skeleton Prices' },
  { key: 'creeper', label: 'Creeper Prices' },
  { key: 'irongolem', label: 'Iron Golem Prices' },
  { key: 'zombifiedpiglin', label: 'Zombified Piglin Prices' },
  { key: 'blaze', label: 'Blaze Prices' },
];

export const SPAWNER_PRICE_PAGE_2_CONFIG = [
  { key: 'cow', label: 'Cow Prices' },
  { key: 'pig', label: 'Pig Prices' },
];

const ORDER = ['buy3', 'buy64', 'sell3', 'sell64'];
const pendingUpdates = new Map();
const PENDING_UPDATE_TTL_MS = 15 * 60 * 1000;

function pendingKey(interaction) {
  return `${interaction.guildId || 'dm'}:${interaction.user.id}`;
}

export function setPendingSpawnerUpdate(interaction, prices) {
  pendingUpdates.set(pendingKey(interaction), {
    prices: structuredClone(prices),
    expiresAt: Date.now() + PENDING_UPDATE_TTL_MS,
  });
}

export function getPendingSpawnerUpdate(interaction) {
  const key = pendingKey(interaction);
  const pending = pendingUpdates.get(key);
  if (!pending || pending.expiresAt <= Date.now()) {
    pendingUpdates.delete(key);
    return null;
  }
  return structuredClone(pending.prices);
}

export function clearPendingSpawnerUpdate(interaction) {
  pendingUpdates.delete(pendingKey(interaction));
}

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

export function buildSpawnerPriceModal(prices = loadPrices(), page = 1) {
  const pageConfig = page === 2 ? SPAWNER_PRICE_PAGE_2_CONFIG : CONFIG;
  const modal = new ModalBuilder()
    .setCustomId(page === 2 ? 'spawner_price_page2' : 'spawner_price_page')
    .setTitle(page === 2 ? 'Spawner Prices • Page 2' : 'Spawner Prices • Page 1');

  for (const { key, label } of pageConfig) {
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

export function parsePrices(text, spawnerName) {
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
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const saved = await getLatestUpdateDataFast(client, interaction.guildId, 'spawnerPrices', null);
      const prices = mergePrices(saved || {});
      for (const { key, label } of CONFIG) {
        prices[key] = parsePrices(interaction.fields.getTextInputValue(key), label);
      }

      setPendingSpawnerUpdate(interaction, prices);
      await interaction.editReply({
        content: '✅ **Page 1 validated.** Click **Continue to Page 2** to review Cow and Pig prices and publish all seven spawner types.',
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('spawner_update_continue')
              .setLabel('Continue to Page 2')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('➡️'),
          ),
        ],
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
