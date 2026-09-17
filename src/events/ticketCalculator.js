import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

function addCalculateButton(message) {
  if (!message?.author?.bot || !message.embeds?.length) return;
  const embedTitle = message.embeds[0]?.title;
  if (!embedTitle || embedTitle === 'Close Request') return;

  const closeButton = message.components?.flatMap((row) => row.components || [])
    .find((component) => component.customId === 'ticket_close');
  if (!closeButton) return;
  if (message.components.some((row) => row.components?.some((component) => component.customId === 'ticket_calculate'))) return;

  const existingButtons = message.components.flatMap((row) => row.components || [])
    .filter((component) => component.customId !== 'ticket_calculate');

  const rows = [];
  if (existingButtons.length) {
    rows.push(new ActionRowBuilder().addComponents(
      ...existingButtons.map((component) => ButtonBuilder.from(component)),
      new ButtonBuilder().setCustomId('ticket_calculate').setLabel('Calculate').setStyle(ButtonStyle.Success),
    ));
  }

  if (rows.length) return message.edit({ components: rows }).catch(() => {});
}

export default {
  name: Events.MessageCreate,
  async execute(message) {
    await addCalculateButton(message);
  },
};
