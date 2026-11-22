import { Events } from 'discord.js';
import { handleCarlReactionChange } from '../services/carlReactionRoles.js';

export default {
  name: Events.MessageReactionRemove,
  async execute(reaction, user, client) {
    await handleCarlReactionChange(reaction, user, client, false);
  },
};
