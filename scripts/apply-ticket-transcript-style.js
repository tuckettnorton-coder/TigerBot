import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ticketFile = path.join(__dirname, '..', 'src', 'services', 'ticket.js');

let source = fs.readFileSync(ticketFile, 'utf8');
let changed = false;

const oldEmbed = /\s*const transcriptEmbed = buildStandardLogEmbed\(\{\n\s*color: 0x3498db,\n\s*title: 'Ticket Transcript',\n\s*description: \[\n\s*formatLogLine\('Ticket', `#\$\{ticketData\.id\}`\),\n\s*formatLogLine\('Channel', `#\$\{channel\.name\}`\),\n\s*formatLogLine\('Generated', `<t:\$\{Math\.floor\(Date\.now\(\) \/ 1000\):F>`\),\n\s*\]\.join\('\\\\n'\),\n\s*footer: deleter\?\.username\n\s*\? \{ text: `Deleted by \$\{deleter\.username\}`, iconURL: deleter\.displayAvatarURL\?\.\(\) \}\n\s*:\s*undefined,\n\s*timestamp: true,\n\s*\}\);/;

const newEmbed = `
                const createdAt = ticketData.createdAt ? new Date(ticketData.createdAt).getTime() : Date.now();
                const closedAt = ticketData.closedAt ? new Date(ticketData.closedAt).getTime() : Date.now();
                const durationMinutes = Math.max(0, Math.floor((closedAt - createdAt) / 60000));
                const messageCount = channel.messages.cache.size;
                const subject = ticketData.reason || 'Support Ticket';

                const transcriptEmbed = buildStandardLogEmbed({
                  color: 0x5865f2,
                  title: 'Auto-Generated Transcript',
                  description: \`Transcript automatically generated for ticket #\${ticketData.id}\`,
                  fields: [
                    {
                      name: 'Ticket',
                      value: [
                        \`Ticket #\${ticketData.id}\`,
                        \`Created by <@\${ticketData.userId}>\`,
                        \`\${messageCount} message\${messageCount === 1 ? '' : 's'}\`,
                      ].join('\\n'),
                      inline: false,
                    },
                    {
                      name: 'Generation',
                      value: [
                        \`Duration: \${durationMinutes} minute\${durationMinutes === 1 ? '' : 's'}\`,
                        'Status: Closed (Auto-transcript)',
                      ].join('\\n'),
                      inline: false,
                    },
                    {
                      name: 'Subject',
                      value: subject.slice(0, 1024),
                      inline: false,
                    },
                  ],
                  footer: {
                    text: \`Powered by TigerBot.com • \${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\`,
                  },
                  timestamp: true,
                });`;

if (!oldEmbed.test(source)) {
  console.log('[transcript-style] Embed already styled or source changed; no embed patch needed.');
} else {
  source = source.replace(oldEmbed, newEmbed);
  changed = true;
}

const oldAttachment = "const attachment = new AttachmentBuilder(buffer, { name: `ticket-${channel.id}.html` });";
const newAttachment = "const attachment = new AttachmentBuilder(buffer, { name: `${channel.name}-transcript.html` });";

if (source.includes(oldAttachment)) {
  source = source.replace(oldAttachment, newAttachment);
  changed = true;
}

if (changed) {
  fs.writeFileSync(ticketFile, source, 'utf8');
  console.log('[transcript-style] Ticket transcript styling applied.');
} else {
  console.log('[transcript-style] No changes required.');
}
