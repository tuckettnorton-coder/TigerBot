import { ActionRowBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import {
  loadPartnerRules,
  persistPartnerRules,
  postPartnerRules,
} from '../../commands/Partners/partnerupdate.js';

export function buildPartnerRulesModal(data = loadPartnerRules()) {
  const modal = new ModalBuilder()
    .setCustomId('partner_rules_update_modal')
    .setTitle('Update Partner Requirements');

  const tiersInput = new TextInputBuilder()
    .setCustomId('tiers')
    .setLabel('Edit Member Ranges')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue([
      `Tier 1: ${data.tier1}`,
      `Tier 2: ${data.tier2}`,
      `Tier 3: ${data.tier3}`,
      `Tier 4: ${data.tier4}`,
      `Tier 5: ${data.tier5}`,
      `Tier 6: ${data.tier6}`,
    ].join('\n'))
    .setPlaceholder('Tier 1: 100–199\nTier 2: 200–399\nTier 3: 400–699\nTier 4: 700–2,499\nTier 5: 2,500–3,999\nTier 6: 4,000+');

  modal.addComponents(new ActionRowBuilder().addComponents(tiersInput));
  return modal;
}

function parseTiers(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length !== 6) {
    throw new Error('Member Ranges must contain exactly 6 lines, one for each partnership tier.');
  }

  const values = {};
  const keys = ['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6'];

  for (let i = 0; i < keys.length; i += 1) {
    const colon = lines[i].indexOf(':');
    if (colon === -1 || !lines[i].slice(colon + 1).trim()) {
      throw new Error(`Invalid Tier ${i + 1}. Use "Tier ${i + 1}: Member Range".`);
    }
    values[keys[i]] = lines[i].slice(colon + 1).trim();
  }

  return values;
}

export default {
  name: 'partner_rules_update_modal',

  async execute(interaction, client) {
    try {
      const tiers = parseTiers(interaction.fields.getTextInputValue('tiers'));
      const data = { ...tiers };

      persistPartnerRules(data);
      await postPartnerRules(client, data);

      await interaction.reply({
        content: '✅ **Partner requirements have been updated and reposted.** The previous TigerBot partner requirements message was deleted first.',
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      await interaction.reply({
        content: `⚠️ **Partner requirements update failed:** ${error?.message || 'Unknown error.'}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
