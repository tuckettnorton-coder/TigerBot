import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getLatestUpdateDataFast, getUpdateState, setUpdateState } from '../../utils/updateState.js';
import { upsertUpdateMessage } from '../../utils/updateMessage.js';

export const SHULKER_UPDATE_CHANNEL_ID = '1566189428131631266';
export const DEFAULT_SHULKER_FEES = Object.freeze({ serviceFeePercent: 30, refundFeePercent: 10 });

export function normalizeShulkerFees(fees = {}) {
  return {
    serviceFeePercent: Number.isFinite(Number(fees.serviceFeePercent)) ? Number(fees.serviceFeePercent) : 30,
    refundFeePercent: Number.isFinite(Number(fees.refundFeePercent)) ? Number(fees.refundFeePercent) : 10,
  };
}

export function formatShulkerServiceMessage(rawFees = DEFAULT_SHULKER_FEES) {
  const fees = normalizeShulkerFees(rawFees);
  const totalBillions = (1 + fees.serviceFeePercent / 100)
    .toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  return [
    '# Inv/Hotbar shulker maker service',
    '- We charge based on how expensive your inv is',
    '- Min: 27 shulkers',
    '',
    '## Additional Notes',
    '- Max **1** stack of respawn anchors per inv/hotbar',
    '- Max **1** stack of Crystals per Inv/hotbar',
    '- Max **1** stack of Gaps per Inv/hotbar',
    '- If you want shields, axe\'s, or turtle you will have to wait longer for your inv/hotbars',
    '- The only items you can order are as followed, ***End Crystals, Obsidian, Respawn anchors, Glowstone, Golden apples, Pickaxe, Sword, Ender pearl, Exp bottles, Totems***',
    '',
    '## The way we calculate how expensive it is',
    `We take the price of the items in your shulker when you order, and we add ${fees.serviceFeePercent}% to that price. Thats the PER shulker price.`,
    `For ex: you ordered 1b worth of stuff, the total would be ${totalBillions}b`,
    '',
    '## 💰 Refund Policy',
    `If you have paid and your shulkers have not started within 48hrs, you may request a refund. However, a **${fees.refundFeePercent}% fee** will be deducted from your refund.`,
    'Once the shulkers have been made ***NO refunds will be taken***',
    '',
    '### WE NEVER GO FIRST',
    '### Make a `Shulker service` <#1504949441650622575> To Buy',
    '<@&1528495941328441456>',
  ].join('\n');
}

export const data = new SlashCommandBuilder()
  .setName('shulker-update')
  .setDescription('Edit Shulker Service markup and refund fees')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction, guildConfig, client) {
  const { buildShulkerUpdateModal } = await import('../../interactions/modals/shulker_update_modal.js');
  const fees = await getLatestUpdateDataFast(client, interaction.guildId, 'shulkerServiceFees', DEFAULT_SHULKER_FEES);
  await interaction.showModal(buildShulkerUpdateModal(normalizeShulkerFees(fees)));
}

export async function postShulkerService(client, guildId, rawFees) {
  const fees = normalizeShulkerFees(rawFees);
  const channel = await client.channels.fetch(SHULKER_UPDATE_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.guild || channel.guild.id !== guildId || typeof channel.send !== 'function') {
    throw new Error('The configured Shulker Service update channel is unavailable in this server.');
  }
  const state = await getUpdateState(client, guildId);
  const content = formatShulkerServiceMessage(fees);

  return upsertUpdateMessage({
    client,
    channel,
    content,
    matches: message => (message.content || '').startsWith('# Inv/Hotbar shulker maker service'),
    previousMessageIds: [state.shulkerServiceMessageId],
    label: 'shulker service',
    onSaved: async message => {
      const saved = await setUpdateState(client, guildId, {
        shulkerServiceFees: fees,
        shulkerServiceMessageId: message.id,
        shulkerServiceChannelId: channel.id,
      });
      if (!saved) throw new Error('The service post was updated, but the fees could not be saved to persistent storage.');
    },
  });
}

export default { data, execute };
