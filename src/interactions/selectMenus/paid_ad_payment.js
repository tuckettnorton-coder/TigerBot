import { EmbedBuilder, MessageFlags } from 'discord.js';
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
      await interaction.deferUpdate();
      await clearTicketEphemeral(interaction.user.id);

      const result = await createTicketChannel({ guild: interaction.guild, user: interaction.user, typeId: 'advertisement', answers: {} });
      if (result.existing) {
        await interaction.editReply({ content: `❌ You already have an open advertisement ticket: ${result.existing}`, components: [] });
        return;
      }

      // Keep the normal ticket layout: welcome message stays separate, while all
      // advertisement facts/questions are placed directly into the regular panel.
      const messages = await result.channel.messages.fetch({ limit: 10 });
      const panelMessage = messages.find(
        (message) => message.author.id === interaction.client.user.id && message.embeds?.some((embed) => embed.title === planInfo[draft.plan]?.label || embed.title === 'Advertisement'),
      );

      const orderDescription = [
        `**Plan:** ${plan.label}`,
        `**Plan Price:** $${planPrice.toFixed(2)}`,
        `**Scheduled Posting:** ${draft.scheduled ? `Yes — ${draft.scheduledTime} (+$${scheduledPrice.toFixed(2)})` : 'No'}`,
        `**Private Advertisement Channel:** ${plan.privateChannel ? 'Included' : 'Not included'}`,
        `**Ping:** ${plan.ping}`,
        `**Giveaway:** ${giveawayLabel}${giveawayPrice ? ` (+$${giveawayPrice.toFixed(2)})` : ''}`,
        `**Extension:** ${extensionLabel}${extensionPrice ? ` (+$${extensionPrice.toFixed(2)})` : ''}`,
        `**Advertisement Duration:** ${totalDays} days`,
        `**Payment Method:** ${payment}`,
        '',
        `### 💵 Total Due: $${total.toFixed(2)}`,
        '',
        `### 📢 Advertisement Details`,
        'Please provide:',
        '• **Server / Business / Community Name**',
        '• **Discord Invite Link**',
        '• **Advertisement Content**',
      ].join('\n');

      if (panelMessage) {
        const panelEmbed = EmbedBuilder.from(panelMessage.embeds[0]).setDescription(orderDescription);
        await panelMessage.edit({ embeds: [panelEmbed] });
      } else {
        // Safety fallback if the standard panel could not be located.
        await result.channel.send({ content: orderDescription });
      }

      const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
      await logTicket(interaction.guild, `🎫 **Ticket opened** • Advertisement • ${displayName} • ${result.channel}`);
      clearPaidAdDraft(interaction.user.id);
      await interaction.editReply({ content: `✅ Advertisement ticket created: ${result.channel}\n💵 **Total due: $${total.toFixed(2)}`, components: [] });
      clearTicketEphemeralLater(interaction);
    } catch (error) {
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content: `❌ Could not create the advertisement ticket: ${error.message}`, components: [] }).catch(() => {});
      else await interaction.reply({ content: `❌ Could not create the advertisement ticket: ${error.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  },
};