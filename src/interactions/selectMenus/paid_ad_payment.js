import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { getPaidAdDraft, setPaidAdDraft, clearPaidAdDraft } from '../../utils/paidAdDrafts.js';
import { loadPaidAdPrices } from '../../utils/paidAdPricing.js';
import { createTicketChannel, logTicket } from '../../services/ticketService.js';
import { clearTicketEphemeral, clearTicketEphemeralLater } from '../../utils/ticketEphemeral.js';

const planInfo = {
  premium: { label: '💎 Premium Bundle', duration: 12, privateChannel: true, ping: '@everyone' },
  standard: { label: '🚀 Standard Bundle', duration: 8, privateChannel: true, ping: '<@&1508954719006232806>' },
  basic: { label: '📢 Basic Bundle', duration: 5, privateChannel: false, ping: '@here' },
};

export default {
  name: 'paid_ad_payment',
  async execute(interaction) {
    try {
      const draft = getPaidAdDraft(interaction.user.id);
      if (!draft?.plan) return interaction.update({ content: '❌ Your advertisement session expired. Please start the ticket again.', components: [] });
      const payment = interaction.values?.[0];
      if (!['PayPal', 'Venmo'].includes(payment)) return interaction.update({ content: '❌ Please choose PayPal or Venmo.', components: [] });

      const prices = loadPaidAdPrices();
      const plan = planInfo[draft.plan];
      if (!plan) return interaction.update({ content: '❌ Invalid advertisement plan.', components: [] });
      const planPrice = Number(prices[draft.plan] || 0);
      const scheduledPrice = draft.scheduled ? Number(prices.scheduled || 0) : 0;
      const giveawayPrice = draft.giveaway === 'nitroPremium' ? Number(prices.nitroPremium || 0) : draft.giveaway === 'nitroBasic' ? Number(prices.nitroBasic || 0) : 0;
      const extensionPrice = draft.extension === 'extend3' ? Number(prices.extend3 || 0) : draft.extension === 'extend7' ? Number(prices.extend7 || 0) : 0;
      const extensionDays = draft.extension === 'extend3' ? 3 : draft.extension === 'extend7' ? 7 : 0;
      const total = planPrice + scheduledPrice + giveawayPrice + extensionPrice;
      const totalDays = plan.duration + extensionDays;
      const giveawayLabel = draft.giveaway === 'nitroPremium' ? '💎 Nitro Premium' : draft.giveaway === 'nitroBasic' ? '🚀 Nitro Basic' : 'None';
      const extensionLabel = draft.extension === 'extend3' ? '+3 days' : draft.extension === 'extend7' ? '+7 days' : 'None';

      setPaidAdDraft(interaction.user.id, { payment, total, totalDays });
      await interaction.update({ content: `### ✅ Paid Advertisement Order Ready\n\n**Plan:** ${plan.label} — $${planPrice.toFixed(2)}\n**Scheduled Posting:** ${draft.scheduled ? `Yes — ${draft.scheduledTime} (+$${scheduledPrice.toFixed(2)})` : 'No'}\n**Giveaway:** ${giveawayLabel}${giveawayPrice ? ` (+$${giveawayPrice.toFixed(2)})` : ''}\n**Extension:** ${extensionLabel}${extensionPrice ? ` (+$${extensionPrice.toFixed(2)})` : ''}\n**Payment Method:** ${payment}\n**Duration:** ${totalDays} days\n\n### 💵 **Total Due: $${total.toFixed(2)}**\n\nCreating your advertisement ticket...`, components: [] });
      await clearTicketEphemeral(interaction.user.id);
      await interaction.deferUpdate();

      const result = await createTicketChannel({ guild: interaction.guild, user: interaction.user, typeId: 'advertisement', answers: {} });
      if (result.existing) {
        await interaction.editReply({ content: `❌ You already have an open advertisement ticket: ${result.existing}`, components: [] });
        return;
      }

      await result.channel.send({ content: `# 💰 Paid Advertisement Order\n\n**Plan:** ${plan.label}\n**Plan Price:** $${planPrice.toFixed(2)}\n**Scheduled Posting:** ${draft.scheduled ? `Yes — ${draft.scheduledTime} (+$${scheduledPrice.toFixed(2)})` : 'No'}\n**Private Advertisement Channel:** ${plan.privateChannel ? 'Included' : 'Not included'}\n**Ping:** ${plan.ping}\n**Giveaway:** ${giveawayLabel}${giveawayPrice ? ` (+$${giveawayPrice.toFixed(2)})` : ''}\n**Extension:** ${extensionLabel}${extensionPrice ? ` (+$${extensionPrice.toFixed(2)})` : ''}\n**Advertisement Duration:** ${totalDays} days\n**Payment Method:** ${payment}\n\n### 💵 **Total Due: $${total.toFixed(2)}**\n\n### 📢 Send Your Advertisement\n**Would you like to send your advertisement in this ticket?**\n\nClick **Yes** or **OK** below to enter your advertisement details.`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('paid_ad_send_yes').setLabel('Yes').setStyle(ButtonStyle.Success).setEmoji('✅'), new ButtonBuilder().setCustomId('paid_ad_send_ok').setLabel('OK').setStyle(ButtonStyle.Primary).setEmoji('👍'))] });

      const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
      await logTicket(interaction.guild, `🎫 **Ticket opened** • Advertisement • ${displayName} • ${result.channel}`);
      clearPaidAdDraft(interaction.user.id);
      await interaction.editReply({ content: `✅ Advertisement ticket created: ${result.channel}\n💵 **Total due: $${total.toFixed(2)}**`, components: [] });
      clearTicketEphemeralLater(interaction);
    } catch (error) {
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content: `❌ Could not create the advertisement ticket: ${error.message}`, components: [] }).catch(() => {});
      else await interaction.reply({ content: `❌ Could not create the advertisement ticket: ${error.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  },
};