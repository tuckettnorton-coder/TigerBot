import {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import {
  getDraft,
  updateDraftPrice,
  persistPrices,
} from '../../commands/Utility/spawnerEditor.js';
import { postPrices } from '../../commands/Utility/spawner-update.js';

const PAGES = {
  1: {
    title: 'Spawner Prices • Skeleton',
    spawner: 'skeleton',
    fields: [
      ['buy3', 'Skeleton 3+ Buy Price'],
      ['buy64', 'Skeleton 64+ Buy Price'],
      ['sell3', 'Skeleton 3+ Sell Price'],
      ['sell64', 'Skeleton 64+ Sell Price'],
    ],
  },
  2: {
    title: 'Spawner Prices • Creeper',
    spawner: 'creeper',
    fields: [
      ['buy3', 'Creeper 3+ Buy Price'],
      ['buy64', 'Creeper 64+ Buy Price'],
      ['sell3', 'Creeper 3+ Sell Price'],
      ['sell64', 'Creeper 64+ Sell Price'],
    ],
  },
  3: {
    title: 'Spawner Prices • Iron Golem',
    spawner: 'irongolem',
    fields: [
      ['buy3', 'Iron Golem 3+ Buy Price'],
      ['buy64', 'Iron Golem 64+ Buy Price'],
      ['sell3', 'Iron Golem 3+ Sell Price'],
      ['sell64', 'Iron Golem 64+ Sell Price'],
    ],
  },
};

export function buildSpawnerPriceModal(page, prices) {
  const config = PAGES[page];
  if (!config) throw new Error('Invalid spawner price modal page.');

  const modal = new ModalBuilder()
    .setCustomId(`spawner_price_page:${page}`)
    .setTitle(config.title);

  for (const [key, label] of config.fields) {
    const input = new TextInputBuilder()
      .setCustomId(key)
      .setLabel(label)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(String(prices?.[config.spawner]?.[key] ?? ''))
      .setPlaceholder('Example: 9M');

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

export default {
  name: 'spawner_price_page',

  async execute(interaction, client, args = []) {
    const page = Number(args[0]);
    const config = PAGES[page];
    const draft = getDraft(interaction);

    if (!config || !draft) {
      await interaction.reply({
        content: '⚠️ Your spawner price update expired. Run `/spawner-update` again.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    for (const [key] of config.fields) {
      const value = interaction.fields.getTextInputValue(key).trim();
      if (!value) {
        await interaction.reply({
          content: '⚠️ Every price must have a value.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      updateDraftPrice(interaction, config.spawner, key, value);
    }

    if (page < 3) {
      await interaction.showModal(buildSpawnerPriceModal(page + 1, draft.prices));
      return;
    }

    try {
      persistPrices(draft.prices);
      await postPrices(client, draft.prices);

      await interaction.reply({
        content: '✅ **All 12 spawner prices have been updated and posted.**\n\nThe prices are displayed automatically in 3 columns: Skeleton, Creeper, and Iron Golem.',
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      await interaction.reply({
        content: `⚠️ **The 12 prices were saved, but I could not post them.**\n\n${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
