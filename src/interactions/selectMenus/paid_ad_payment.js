import { MessageFlags } from 'discord.js';
import { getPaidAdDraft, setPaidAdDraft, clearPaidAdDraft } from '../../utils/paidAdDrafts.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';
import { createTicketChannel, logTicket } from '../../services/ticketService.js';
import { clearTicketEphemeral, clearTicketEphemeralLater } from '../../utils/ticketEphemeral.js';

const planInfo = {
  premium: { label: '💎 Premium Bundle', baseDays: 12, privateChannel: true, ping: '@everyone' },
  standard: { label: '🚀 Standard Bundle', baseDays: 8, privateChannel: true, ping: '<@&1508954719006232806>' },
  basic: { label: '📢 Basic Bundle', baseDays: 5, privateChannel: false, ping: '@here' },
};

export default {
  name: 'paid_ad_payment',
  async execute(interaction) {
    try {
      const draft = getPaidAdDraft(interaction.user.id);
      if (!draft?.plan || !draft.adName || !draft.adLink || !draft.adContent) {
        return interaction.update({ content: '❌ Your advertisement session expired. Please start the ticket again.', components: [] });
      }
      const payment = interaction.values[0];
      const prices = loadPaidAdPrices();
      const plan = planInfo[draft.plan];
      const planPrice = Number(prices[draft.plan] || 0);
      const scheduledPrice = draft.scheduled ? Number(prices.scheduled || 0) : 0;
      const giveawayPrice = draft.giveaway === 'nitroPremium' ? Number(prices.nitroPremium || 0) : draft.giveaway === 'nitroBasic' ? Number(prices.nitroBasic || 0) : 0;
      const extensionPrice = draft.extension === 'extend3' ? Number(prices.extend3 || 0) : draft.extension === 'extend7' ? Number(prices.extend7 || 0) : 0;
      const total = planPrice + scheduledPrice + giveawayPrice + extensionPrice;
      const totalDays = plan.baseDays + Number(draft.extensionDays || 0);
      const giveawayLabel = draft.giveaway === 'nitroPremium' ? '💎 Nitro Premium' : draft.giveaway === 'nitroBasic' ? '🚀 Nitro Basic' : 'None';
      const extensionLabel = draft.extension === 'extend3' ? '+3 days' : draft.extension === 'extend7' ? '+7 days' : 'None';
      const answers = {
        ad_name: draft.adName,
        ad_link: draft.adLink,
        ad_content: draft.adContent,
      };
      await clearTicketEphemeral(interaction.user.id);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await createTicketChannel({ guild: interaction.guild, user: interaction.user, typeId: 'advertisement', answers });
      if (result.existing) return interaction.editReply(`You already have an open advertisement ticket: ${result.existing}`);
      await result.channel.send({ content: `# 💰 Paid Advertisement Order\n\n**Advertising:** ${draft.adName}\n**Invite:** ${draft.adLink}\n\n**Plan:** ${plan.label}\n**Plan Price:** $${planPrice}\n**Scheduled Posting:** ${draft.scheduled ? `Yes — ${draft.scheduledTime} (+$${scheduledPrice})` : 'No'}\n**Private Advertisement Channel:** ${plan.privateChannel ? 'Included' : 'Not included'}\n**Ping:** ${plan.ping}\n**Giveaway:** ${giveawayLabel}${giveawayPrice ? ` (+$${giveawayPrice})` : ''}\n**Extension:** ${extensionLabel}${extensionPrice ? ` (+$${extensionPrice})` : ''}\n**Advertisement Duration:** ${totalDays} days\n**Payment Method:** ${payment}\n\n### 📝 Advertisement Content\n${draft.adContent}\n\n### 💵 **Total Due: $${total.toFixed(2)}**\n\nPlease wait for staff to confirm payment and the advertisement details before posting.` });
      const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
      await logTicket(interaction.guild, `🎫 **Ticket opened** • Advertisement • ${displayName} • ${result.channel}`);
      clearPaidAdDraft(interaction.user.id);
      await interaction.editReply(`✅ Advertisement ticket created: ${result.channel}\n💵 **Total due: $${total.toFixed(2)}**`);
      clearTicketEphemeralLater(interaction);
    } catch (error) {
      if (interaction.deferred || interaction.replied) await interaction.editReply(`❌ Could not create the advertisement ticket: ${error.message}`).catch(() => {});
      else await interaction.reply({ content: `❌ Could not create the advertisement ticket: ${error.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  },
};