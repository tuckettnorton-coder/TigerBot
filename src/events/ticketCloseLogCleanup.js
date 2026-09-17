import { getGuildConfig } from '../services/config/guildConfig.js';
import { logger } from '../utils/logger.js';

export default {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    try {
      if (!message.guild || message.author?.id !== message.client.user?.id) return;
      if (!message.embeds?.length) return;
      if (message.embeds[0]?.title !== 'Ticket Closed') return;

      const config = await getGuildConfig(message.client, message.guild.id);
      if (!config.ticketLogsChannelId) return;
      if (message.channel.id !== config.ticketLogsChannelId) return;

      await message.delete().catch(() => {});
      logger.info(`Removed ticket close log message ${message.id} from ${message.channel.id}`);
    } catch (error) {
      logger.error('Failed to remove ticket close log:', error);
    }
  },
};
