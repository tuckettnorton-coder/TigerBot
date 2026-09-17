import { MessageFlags } from 'discord.js';
import { buildPaidAdUpdateModal } from '../modals/paid_ad_update_modal.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';

export default {
  name: 'paid_ad_update_continue',
  async execute(interaction) {
    try {
      await interaction.showModal(buildPaidAdUpdateModal(loadPaidAdPrices(), 2));
    } catch (error) {
      await interaction.reply({
        content: `⚠️ **Paid ad update failed:** ${error?.message || 'Unknown error.'}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    }
  },
};
