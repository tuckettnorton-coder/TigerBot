import { getTicketData } from '../utils/database.js';
import { generateTicketTranscript } from '../utils/ticket/ticketTranscript.js';
import { logger } from '../utils/logger.js';

async function getBotOwner(client, guild) {
  try {
    await client.application.fetch();
    const owner = client.application.owner;

    if (owner && typeof owner.send === 'function') {
      return owner;
    }
  } catch (error) {
    logger.warn(`Could not fetch bot application owner: ${error.message}`);
  }

  try {
    const guildOwner = await guild.fetchOwner();
    return guildOwner?.user || null;
  } catch (error) {
    logger.warn(`Could not fetch guild owner for ticket transcript DM: ${error.message}`);
    return null;
  }
}

export default {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    try {
      if (!message.guild || message.author?.id !== message.client.user?.id) return;
      if (!message.embeds?.length) return;
      if (message.embeds[0]?.title !== 'Ticket Closed') return;

      const ticketData = await getTicketData(message.guild.id, message.channel.id);
      if (!ticketData) return;

      const transcript = await generateTicketTranscript(message.channel);
      if (!transcript) return;

      const owner = await getBotOwner(message.client, message.guild);
      if (!owner) {
        logger.warn(`No bot owner available for ticket transcript DM: ${message.channel.id}`);
        return;
      }

      await owner.send({
        content: `Ticket transcript saved: **${message.channel.name}** (Ticket ID: ${ticketData.id})`,
        files: [transcript],
      });

      logger.info(`Ticket transcript DMed to bot owner for ${message.channel.name}`);
    } catch (error) {
      logger.error('Failed to DM ticket transcript to bot owner:', error);
    }
  },
};
