import { AttachmentBuilder } from 'discord.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
import { getTicketData } from '../utils/database.js';
import { logger } from '../utils/logger.js';

const processedTickets = new Set();

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function generateTranscript(channel) {
  const messages = [];
  let before;

  do {
    const batch = await channel.messages.fetch({
      limit: 100,
      ...(before ? { before } : {}),
    });

    if (batch.size === 0) break;
    messages.push(...batch.values());
    before = batch.last()?.id;
  } while (messages.length === 0 || before);

  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const rows = messages.map((message) => {
    const timestamp = new Date(message.createdTimestamp)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);
    const author = escapeHtml(message.author?.tag || message.author?.username || 'Unknown');

    let content = message.content || '';
    if (message.embeds?.length) content += content ? ' [embed]' : '[embed]';
    if (message.attachments?.size) content += content ? ' [attachment]' : '[attachment]';
    if (!content) content = '[no text content]';

    return `<tr><td class="ts">${timestamp}</td><td class="author">${author}</td><td class="msg">${escapeHtml(content)}</td></tr>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Transcript – #${escapeHtml(channel.name)}</title>
<style>
body{font-family:Arial,sans-serif;background:#36393f;color:#dcddde;margin:0;padding:20px}
h1{color:#fff;font-size:22px}
p{color:#8e9297}
table{width:100%;border-collapse:collapse;background:#2f3136}
th{color:#fff;text-align:left;padding:10px;border-bottom:2px solid #202225}
td{padding:8px 10px;border-bottom:1px solid #40444b;vertical-align:top}
.ts{color:#72767d;white-space:nowrap;width:170px}
.author{color:#7289da;white-space:nowrap;width:180px}
.msg{word-break:break-word;white-space:pre-wrap}
</style>
</head>
<body>
<h1>Ticket Transcript – #${escapeHtml(channel.name)}</h1>
<p>${messages.length} message(s) exported on ${escapeHtml(new Date().toUTCString())}</p>
<table>
<thead><tr><th>Timestamp (UTC)</th><th>Author</th><th>Message</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;

  return new AttachmentBuilder(Buffer.from(html, 'utf8'), {
    name: `ticket-${channel.id}.html`,
  });
}

async function getApplicationOwner(client) {
  try {
    await client.application.fetch();
    const owner = client.application.owner;

    if (!owner) return null;
    if (owner.user) return owner.user;
    return owner;
  } catch (error) {
    logger.error('Could not fetch TigerBot application owner:', error);
    return null;
  }
}

export default {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    try {
      if (!message.guild || !message.channel) return;

      const config = await getGuildConfig(message.client, message.guild.id);

      // Remove all Ticket Closed entries from the ticket log channel.
      if (
        config.ticketLogsChannelId &&
        message.channel.id === config.ticketLogsChannelId &&
        message.embeds?.some((embed) => embed.title === 'Ticket Closed')
      ) {
        await message.delete().catch(() => {});
        return;
      }

      // Only react to the actual Ticket Closed status message inside a ticket.
      if (!message.author?.bot) return;
      if (!message.embeds?.some((embed) => embed.title === 'Ticket Closed')) return;

      const ticketData = await getTicketData(message.guild.id, message.channel.id).catch(() => null);
      if (!ticketData || ticketData.status !== 'closed') return;
      if (processedTickets.has(message.channel.id)) return;

      processedTickets.add(message.channel.id);

      // Wait briefly so the closing message and any final ticket messages are included.
      await new Promise((resolve) => setTimeout(resolve, 750));

      const transcript = await generateTranscript(message.channel);
      const owner = await getApplicationOwner(message.client);

      if (!owner) {
        logger.warn(`Could not DM the TigerBot owner the transcript for ticket ${message.channel.id}.`);
        return;
      }

      await owner.send({
        content: `Ticket transcript for **${message.channel.name}**.`,
        files: [transcript],
      });

      logger.info(`Sent full ticket transcript to TigerBot owner for ${message.channel.name}.`);
    } catch (error) {
      logger.error('Failed to DM full ticket transcript:', error);
    }
  },
};
