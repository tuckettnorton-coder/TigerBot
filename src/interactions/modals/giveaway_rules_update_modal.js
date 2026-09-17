import {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import {
  loadGiveawayRules,
  persistGiveawayRules,
  postGiveawayRules,
} from '../../commands/Giveaway/giveawayrulesupdate.js';

export function buildGiveawayRulesModal(data = loadGiveawayRules()) {
  const modal = new ModalBuilder()
    .setCustomId('giveaway_rules_update_modal')
    .setTitle('Update Giveaway Rules');

  const timesInput = new TextInputBuilder()
    .setCustomId('times')
    .setLabel('Giveaway Claim Times')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue([
      `Daily Giveaways: ${data.dailyTime ?? '24 Hours'}`,
      `Big Giveaways: ${data.bigTime ?? '6 Hours'}`,
      `Quick Drops: ${data.quickTime ?? '1 Hour'}`,
    ].join('\n'))
    .setPlaceholder('Daily Giveaways: 24 Hours\nBig Giveaways: 6 Hours\nQuick Drops: 1 Hour');

  const payoutInput = new TextInputBuilder()
    .setCustomId('payout')
    .setLabel('Prize Payout Time')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(data.payoutTime ?? '3–5 days')
    .setPlaceholder('Example: 3–5 days');

  const fakeClaimInput = new TextInputBuilder()
    .setCustomId('fake_claim')
    .setLabel('Fake / Edited Claim Action')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue(data.fakeClaimAction ?? '')
    .setPlaceholder('Enter what happens when someone uses a fake or edited claim screenshot.');

  const pingInput = new TextInputBuilder()
    .setCustomId('ping_rule')
    .setLabel('Claim Ticket Ping Rule')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue(data.pingRule ?? '')
    .setPlaceholder('Example: Pinging anyone in your claim ticket = NO PAY.');

  const sosInput = new TextInputBuilder()
    .setCustomId('sos_rule')
    .setLabel('SOS Giveaway Rule')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue(data.sosRule ?? '')
    .setPlaceholder('Enter the SOS giveaway rule.');

  modal.addComponents(
    new ActionRowBuilder().addComponents(timesInput),
    new ActionRowBuilder().addComponents(payoutInput),
    new ActionRowBuilder().addComponents(fakeClaimInput),
    new ActionRowBuilder().addComponents(pingInput),
    new ActionRowBuilder().addComponents(sosInput),
  );

  return modal;
}

function parseTimes(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length !== 3) {
    throw new Error('Giveaway Claim Times must contain exactly 3 lines: Daily Giveaways, Big Giveaways, Quick Drops.');
  }

  const keys = ['dailyTime', 'bigTime', 'quickTime'];
  const values = {};

  for (let i = 0; i < keys.length; i += 1) {
    const colon = lines[i].indexOf(':');
    if (colon === -1 || !lines[i].slice(colon + 1).trim()) {
      throw new Error(`Invalid claim time line ${i + 1}. Use "Label: Time".`);
    }
    values[keys[i]] = lines[i].slice(colon + 1).trim();
  }

  return values;
}

export default {
  name: 'giveaway_rules_update_modal',

  async execute(interaction, client) {
    try {
      const times = parseTimes(interaction.fields.getTextInputValue('times'));
      const payoutTime = interaction.fields.getTextInputValue('payout').trim();
      const fakeClaimAction = interaction.fields.getTextInputValue('fake_claim').trim();
      const pingRule = interaction.fields.getTextInputValue('ping_rule').trim();
      const sosRule = interaction.fields.getTextInputValue('sos_rule').trim();

      if (!payoutTime) throw new Error('Prize Payout Time cannot be empty.');
      if (!fakeClaimAction) throw new Error('Fake / Edited Claim Action cannot be empty.');
      if (!pingRule) throw new Error('Claim Ticket Ping Rule cannot be empty.');
      if (!sosRule) throw new Error('SOS Giveaway Rule cannot be empty.');

      const data = {
        ...times,
        payoutTime,
        fakeClaimAction,
        pingRule,
        sosRule,
      };

      persistGiveawayRules(data);
      await postGiveawayRules(client, data);

      await interaction.reply({
        content: '✅ **Giveaway rules have been updated and reposted.** The previous TigerBot giveaway rules message was deleted first.',
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      await interaction.reply({
        content: `⚠️ **Giveaway rules update failed:** ${error?.message || 'Unknown error.'}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
