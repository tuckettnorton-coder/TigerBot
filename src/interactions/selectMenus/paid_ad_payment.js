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
      const payment = interaction.values[0];
      if (!['PayPal', 'Venmo'].includes(payment)) return interaction.update({ content: '❌ Please choose PayPal or Venmo.', components: [] });
      const prices = loadPaidAdPrices();
      const plan = planInfo[draft.plan];
      const planPrice = Number(prices[draft.plan] || 0);
      setPaidAdDraft(interaction.user.id, { payment });
      await clearTicketEphemeral(interaction.user.id);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await createTicketChannel({ guild: interaction.guild, user: interaction.user, typeId: 'advertisement', answers: {} });
      if (result.existing) return interaction.editReply(`You already have an open advertisement ticket: ${result.existing}`);

      await result.channel.send({ content: `# 💰 Paid Advertisement\n\n**Plan:** ${plan.label}\n**Plan Price:** $${planPrice.toFixed(2)}\n**Advertisement Duration:** ${plan.duration} days\n**Payment Method:** ${payment}\n**Private Advertisement Channel:** ${plan.privateChannel ? 'Included' : 'Not included'}\n**Ping:** ${plan.ping}\n\n### 📢 Send Your Advertisement\n**Would you like to send your advertisement in this ticket?**\n\nClick **Yes** or **OK** below to enter your advertisement details.`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('paid_ad_send_yes').setLabel('Yes').setStyle(ButtonStyle.Success).setEmoji('✅'), new ButtonBuilder().setCustomId('paid_ad_send_ok').setLabel('OK').setStyle(ButtonStyle.Primary).setEmoji('👍'))] });
      const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
      await logTicket(interaction.guild, `🎫 **Ticket opened** • Advertisement • ${displayName} • ${result.channel}`);
      clearPaidAdDraft(interaction.user.id);
      await interaction.editReply(`✅ Advertisement ticket created: ${result.channel}\n💵 **Total due: $${planPrice.toFixed(2)}**`);
      clearTicketEphemeralLater(interaction);
    } catch (error) {
      if (interaction.deferred || interaction.replied) await interaction.editReply(`❌ Could not create the advertisement ticket: ${error.message}`).catch(() => {});
      else await interaction.reply({ content: `❌ Could not create the advertisement ticket: ${error.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  },
};
