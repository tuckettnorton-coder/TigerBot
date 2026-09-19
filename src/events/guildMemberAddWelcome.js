import { logger } from '../utils/logger.js';

const WELCOME_CHANNEL_ID = '1504917892100001892';

const WELCOME_MESSAGES = [
  'Welcome to **Tiger Market**, {user}! Glad to have you here! You are our **{member_count}th member!**\n\nMake sure to check out <#1504948495948452001> <#1513625068239065158> <#1513625388503535657> <#1519838464374476991> <#1547003075108147210>',
  'Welcome, {user}! Enjoy your stay in **Tiger Market**! You are our **{member_count}th member!**\n\nMake sure to check out <#1504948495948452001> <#1513625068239065158> <#1513625388503535657> <#1519838464374476991> <#1547003075108147210>',
  'Hey {user}, welcome to the community! You are our **{member_count}th member!**\n\nMake sure to check out <#1504948495948452001> <#1513625068239065158> <#1513625388503535657> <#1519838464374476991> <#1547003075108147210>',
  'Welcome to **Tiger Market**, {user}! Have fun! You are our **{member_count}th member!**\n\nMake sure to check out <#1504948495948452001> <#1513625068239065158> <#1513625388503535657> <#1519838464374476991> <#1547003075108147210>',
  '{user} just joined! Welcome to Tiger Market! You are our **{member_count}th member!**\n\nMake sure to check out <#1504948495948452001> <#1513625068239065158> <#1513625388503535657> <#1519838464374476991> <#1547003075108147210>',
  'Welcome in, {user}! Make yourself at home! You are our **{member_count}th member!**\n\nMake sure to check out <#1504948495948452001> <#1513625068239065158> <#1513625388503535657> <#1519838464374476991> <#1547003075108147210>',
  'Glad to have you here, {user}! Welcome! You are our **{member_count}th member!**\n\nMake sure to check out <#1504948495948452001> <#1513625068239065158> <#1513625388503535657> <#1519838464374476991> <#1547003075108147210>',
  'Welcome to **Tiger Market**, {user}! Happy trading! You are our **{member_count}th member!**\n\nMake sure to check out <#1504948495948452001> <#1513625068239065158> <#1513625388503535657> <#1519838464374476991> <#1547003075108147210>',
  '{user}, welcome to the family! Enjoy the server! You are our **{member_count}th member!**\n\nMake sure to check out <#1504948495948452001> <#1513625068239065158> <#1513625388503535657> <#1519838464374476991> <#1547003075108147210>',
  'Welcome, {user}! Thanks for joining **Tiger Market**! You are our **{member_count}th member!**\n\nMake sure to check out <#1504948495948452001> <#1513625068239065158> <#1513625388503535657> <#1519838464374476991> <#1547003075108147210>',
];

export default {
  name: 'guildMemberAdd',
  once: false,
  async execute(member) {
    try {
      const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);

      if (!channel || !channel.isTextBased()) {
        logger.warn(`Welcome channel ${WELCOME_CHANNEL_ID} was not found or is not text-based in guild ${member.guild.id}.`);
        return;
      }

      const template = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
      const message = template
        .replaceAll('{user}', `<@${member.id}>`)
        .replaceAll('{member_count}', String(member.guild.memberCount));

      await channel.send(message);
    } catch (error) {
      logger.error(`Failed to send welcome message for ${member.user.tag}:`, error);
    }
  },
};
