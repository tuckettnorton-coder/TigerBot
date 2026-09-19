import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getTicketFromChannel } from '../services/ticketService.js';
import { TICKET_TYPES } from '../config/ticketTypes.js';

export default {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.author.bot || !message.attachments?.size) return;

    const ticket = getTicketFromChannel(message.channel);
    if (!ticket || ticket.typeId !== 'building_services' || ticket.openerId !== message.author.id) return;

    const panel = (await message.channel.messages.fetch({ limit: 30 }).catch(() => null))
      ?.find((m) => m.embeds?.some((embed) => embed.title === TICKET_TYPES.building_services.label));

    if (!panel?.embeds?.[0]) return;

    const attachments = [...message.attachments.values()];
    const embed = EmbedBuilder.from(panel.embeds[0]);
    const links = attachments.map((attachment) => `[📐 ${attachment.name || 'Schematic'}](${attachment.url})`).join('\n').slice(0, 1024);

    const existingFieldIndex = embed.data.fields?.findIndex((field) => field.name === '📐 Schematic Upload');
    if (existingFieldIndex >= 0) {
      embed.spliceFields(existingFieldIndex, 1, {
        name: '📐 Schematic Upload',
        value: links || 'No schematic attachment found.',
        inline: false,
      });
    } else {
      embed.addFields({
        name: '📐 Schematic Upload',
        value: links || 'No schematic attachment found.',
        inline: false,
      });
    }

    const rows = panel.components?.map((row) => ActionRowBuilder.from(row)) || [];
    const downloadButtons = attachments.slice(0, 5).map((attachment, index) =>
      new ButtonBuilder()
        .setLabel(`Download ${index + 1}`)
        .setEmoji('📥')
        .setStyle(ButtonStyle.Link)
        .setURL(attachment.url)
    );

    if (downloadButtons.length) rows.push(new ActionRowBuilder().addComponents(downloadButtons));

    await panel.edit({ embeds: [embed], components: rows });
  },
};
