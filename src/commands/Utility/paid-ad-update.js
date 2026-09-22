import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';
import { getLatestUpdateData } from '../../utils/updateState.js';

export const PAID_AD_UPDATE_CHANNEL_ID = '1525901034747330693';

export const data = new SlashCommandBuilder()
  .setName('paid-ad-update')
  .setDescription('Update Paid Advertisement prices and repost the price list')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction, guildConfig, client) {
  const { buildPaidAdUpdateModal } = await import('../../interactions/modals/paid_ad_update_modal.js');
  const saved = await getLatestUpdateData(client, interaction.guildId, 'paidAdPrices', null);
  await interaction.showModal(buildPaidAdUpdateModal(saved || loadPaidAdPrices(), 1));
}

export default { data, execute };
