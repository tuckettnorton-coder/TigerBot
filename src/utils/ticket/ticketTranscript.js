import { AttachmentBuilder } from 'discord.js';
import { logger } from '../logger.js';

export async function generateTicketTranscript(channel) {
  try {
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
    } while (before);

    messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    const escape = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const rows = messages.map((msg) => {
      const timestamp = new Date(msg.createdTimestamp)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 19);
      const author = escape(msg.author?.tag ?? msg.author?.username ?? 'Unknown');
      const content = escape(
        msg.content ||
        (msg.embeds.length ? '[embed]' : msg.attachments.size ? '[attachment]' : '[message]')
      );

      return `<tr><td class="ts">${timestamp}</td><td class="author">${author}</td><td class="msg">${content}</td></tr>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Transcript – #${escape(channel.name)}</title>
<style>
body{font-family:sans-serif;background:#36393f;color:#dcddde;margin:0;padding:16px}
h1{color:#fff;font-size:1.2rem;margin-bottom:8px}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th{background:#2f3136;color:#8e9297;padding:6px 8px;text-align:left;border-bottom:2px solid #202225}
td{padding:4px 8px;border-bottom:1px solid #40444b;vertical-align:top}
.ts{color:#72767d;white-space:nowrap;width:160px}
.author{color:#7289da;white-space:nowrap;width:160px}
.msg{word-break:break-word}
</style>
</head>
<body>
<h1>Ticket Transcript – #${escape(channel.name)}</h1>
<p style="color:#72767d">${messages.length} message(s) exported on ${new Date().toUTCString()}</p>
<table>
<thead><tr><th>Timestamp (UTC)</th><th>Author</th><th>Message</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>`;

    return new AttachmentBuilder(Buffer.from(html, 'utf8'), {
      name: `ticket-${channel.id}.html`,
    });
  } catch (error) {
    logger.error('Failed to generate ticket transcript:', {
      channelId: channel?.id,
      channelName: channel?.name,
      errorMessage: error.message,
    });
    return null;
  }
}
