import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';

export const PAID_AD_UPDATE_CHANNEL_ID = '1525901034747330693';

export const data = new SlashCommandBuilder()
  .setName('paid-ad-update')
  .setDescription('Update Paid Advertisement prices and repost the price list')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const { buildPaidAdUpdateModal } = await import('../../interactions/modals/paid_ad_update_modal.js');
  await interaction.showModal(buildPaidAdUpdateModal(loadPaidAdPrices(), 1));
}

export default { data, execute };