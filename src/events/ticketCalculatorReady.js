import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    for (const guild of client.guilds.cache.values()) {
      for (const channel of guild.channels.cache.values()) {
        if (!channel.isTextBased?.() || !channel.messages?.fetch) continue;
        const ticket = channel.name?.match(/-(\d{4})$/);
        if (!ticket) continue;

        const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
        if (!messages) continue;

        const target = messages.find((message) => {
          if (!message.author?.bot || !message.embeds?.length) return false;
          if (message.embeds[0]?.title === 'Close Request') return false;
          return message.components?.flatMap((row) => row.components || [])
            .some((component) => component.customId === 'ticket_close');
        });

        if (!target || target.components.some((row) => row.components?.some((component) => component.customId === 'ticket_calculate'))) continue;

        const buttons = target.components.flatMap((row) => row.components || []);
        const row = new ActionRowBuilder().addComponents(
          ...buttons.map((component) => ButtonBuilder.from(component)),
          new ButtonBuilder().setCustomId('ticket_calculate').setLabel('Calculate').setStyle(ButtonStyle.Success),
        );
        await target.edit({ components: [row] }).catch(() => {});
      }
    }
  },
};
