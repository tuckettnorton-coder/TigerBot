import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getLevelingConfig, getUserLevelData } from '../services/leveling/leveling.js';
import { addXp } from '../services/leveling/xpSystem.js';
import { checkRateLimit } from '../utils/rateLimiter.js';
import { parsePrefixCommand } from '../utils/prefixParser.js';
import { supportsPrefixExecution, executePrefixCommand, resolvePrefixAccessKey } from '../utils/messageAdapter.js';
import { resolveCommandAlias, resolveSubcommandAlias } from '../config/commands/commandAliases.js';
import { getPrefixRestriction } from '../config/commands/prefixRestrictions.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
import { getCommandPrefix, getBotMessage, isBotOwner, isCommandCategoryEnabled, isMaintenanceMode } from '../config/bot.js';
import { enforceAbuseProtection, formatCooldownDuration } from '../utils/abuseProtection.js';
import { createEmbed } from '../utils/embeds.js';
import { WarningService } from '../services/moderation/warningService.js';
import { logModerationAction } from '../utils/moderation.js';
import { isCommandEnabled } from '../services/commandAccessService.js';
import {
  getCountingGameConfig,
  saveCountingGameConfig,
  isValidCountingMessage,
  recordCorrectCount,
} from '../services/countingGameService.js';

const MESSAGE_XP_RATE_LIMIT_ATTEMPTS = 12;
const MESSAGE_XP_RATE_LIMIT_WINDOW_MS = 10000;
const REPEAT_MESSAGE_KEY = (guildId) => 'guild:' + guildId + ':repeat-message';

const MARKETING_FILTER_CHANNELS = new Set([
  '1504946935197597878',
  '1526319312078372974',
]);

const MARKETING_FILTER_EXEMPT_ROLES = new Set([
  '1513634231480483991',
  '1529641819045341',
]);

const MARKETING_WORDS = [
  'sell', 'buy', 'selling', 'for sale buy', 'buying',
  'looking to buy trade', 'trading', 'swap price', 'pricing',
  'cost offer', 'offering', 'deals service', 'services',
  'commissions dm me to buy', 'message me for price cheap',
  'discount', 'bargain payment', 'pay', 'paid vendor', 'shop',
  'store available', 'in stock', 'inventory order', 'preorder cash',
  'funds paypal', 'auction', String.fromCharCode(36) + String.fromCharCode(36) + String.fromCharCode(36),
  'Services', 'per Block', 'Digging Service', "If you're interested",
  'Message me', 'Text me', 'Sale', 'Dm for money', 'DM me',
];

function normalizeMarketingText(content) {
  return String(content || '')
    .toLowerCase()
    .replace(/[“”‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function findMarketingWord(content) {
  const normalized = normalizeMarketingText(content);
  for (const word of MARKETING_WORDS) {
    const normalizedWord = normalizeMarketingText(word);
    if (!normalizedWord) continue;
    const escaped = normalizedWord.replace(/[.*+?^$()|[\]\\]/g, character => '\\' + character);
');
    const pattern = new RegExp(
      '(^|[^a-z0-9])' + escaped.replace(/ /g, '\\s+') + '(?=$|[^a-z0-9])',
      'i'
    );
    if (pattern.test(normalized)) return word;
  }
  return null;
}

function hasMarketingFilterExemption(message) {
  return Boolean(message.member?.roles?.cache?.some(role => MARKETING_FILTER_EXEMPT_ROLES.has(role.id)));
}

async function handleMarketingFilter(message, client) {
  if (!MARKETING_FILTER_CHANNELS.has(message.channelId)) return false;
  if (hasMarketingFilterExemption(message)) return false;

  const matchedWord = findMarketingWord(message.content);
  if (!matchedWord) return false;

  const reason = 'Marketing word detected: "' + matchedWord + '"';
  const moderatorId = client.user?.id || 'TigerBot';

  const deleted = await message.delete().then(() => true).catch(error => {
    logger.error('Marketing filter could not delete message:', error);
    return false;
  });

  let warningResult = null;
  try {
    warningResult = await WarningService.addWarning({
      guildId: message.guild.id,
      userId: message.author.id,
      moderatorId,
      reason,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Marketing filter could not create warning:', error);
  }

  try {
    await logModerationAction({
      client,
      guild: message.guild,
      event: {
        action: 'User Warned',
        target: message.author.tag + ' (' + message.author.id + ')',
        executor: (client.user?.tag || 'TigerBot') + ' (' + moderatorId + ')',
        reason,
        metadata: {
          userId: message.author.id, moderatorId,
          totalWarns: warningResult?.totalCount ?? null,
          warningNumber: warningResult?.totalCount ?? null,
          warningId: warningResult?.id ?? null,
          automatic: true, matchedMarketingWord: matchedWord, channelId: message.channelId,
        },
      },
    });
  } catch (error) {
    logger.error('Marketing filter could not log moderation action:', error);
  }

  try {
    await message.channel.send({
      content: '<@' + message.author.id + '> Sorry, **"' + matchedWord + '"** is a marketing word and marketing is not allowed here. Your message has been deleted and you have received a warning.',
      allowedMentions: { users: [message.author.id] },
    });
  } catch (error) {
    logger.error('Marketing filter could not send warning message:', error);
  }

  logger.info('Marketing filter triggered in ' + message.channelId + ' for ' + message.author.tag + ' matching "' + matchedWord + '" (deleted=' + deleted + ')');
  return true;
}

export default {
  name: Events.MessageCreate,
  async execute(message, client) {
    try {
      if (message.author.bot || !message.guild) return;

      logger.debug(`Message received from ${message.author.tag}: ${message.content}`);

      const marketingFiltered = await handleMarketingFilter(message, client);
      if (marketingFiltered) return;

      const repeated = await handleRepeatMessage(message, client);
      if (repeated) {
        return;
      }

      const countingProcessed = await handleCountingGame(message, client);
      if (countingProcessed) {
        return;
      }

      await handlePrefixCommand(message, client);
      await handleLeveling(message, client);
    } catch (error) {
      logger.error('Error in messageCreate event:', error);
    }
  }
};

async function handleRepeatMessage(message, client) {
  try {
    if (!client?.db || !message.guild) return false;

    const config = await client.db.get(REPEAT_MESSAGE_KEY(message.guild.id), null);
    if (!config) return false;

    // Sticky settings are stored per channel, so one guild can have as many
    // sticky channels as needed. The old single-channel format is migrated on read.
    const channels = config.channels && typeof config.channels === 'object'
      ? config.channels
      : (config.channelId ? {
          [config.channelId]: {
            message: config.message,
            messageId: config.messageId || null,
            enabled: config.enabled !== false,
          },
        } : {});

    const channelConfig = channels[message.channelId];
    if (!channelConfig?.enabled || !channelConfig.message) return false;

    // Leave the user's message alone, remove this channel's old sticky, and
    // repost it so the sticky for this channel stays at the bottom.
    if (channelConfig.messageId) {
      const oldSticky = await message.channel.messages.fetch(channelConfig.messageId).catch(() => null);
      if (oldSticky) await oldSticky.delete().catch(() => {});
    }

    const stickyMessage = await message.channel.send({
      content: channelConfig.message,
      allowedMentions: { parse: [] },
    });

    await client.db.set(REPEAT_MESSAGE_KEY(message.guild.id), {
      ...config,
      channels: {
        ...channels,
        [message.channelId]: {
          ...channelConfig,
          messageId: stickyMessage.id,
          updatedAt: new Date().toISOString(),
          enabled: true,
        },
      },
      updatedAt: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    logger.error('Error handling sticky message:', error);
    return false;
  }
}

async function handlePrefixCommand(message, client) {
  try {
    const guildConfig = await getGuildConfig(client, message.guild.id);
    const prefix = guildConfig?.prefix || getCommandPrefix();
    const parsed = parsePrefixCommand(message.content, prefix);
    
    if (!parsed) {
      return; 
    }

    let { commandName, args } = parsed;
    const musicPrefixShortcut = commandName.toLowerCase();
    const MUSIC_PREFIX_SHORTCUTS = new Set(['leave', 'pause', 'resume', 'skip', 'stop', 'volume']);
    if (MUSIC_PREFIX_SHORTCUTS.has(musicPrefixShortcut)) {
      commandName = 'music';
      args = [musicPrefixShortcut, ...args];
    }

    logger.info(`Prefix command detected: ${commandName}, args: ${args.join(', ')}`);

    const resolvedCommandName = resolveCommandAlias(commandName);
    logger.info(`Resolved command name: ${resolvedCommandName}`);
    const command = client.commands.get(resolvedCommandName);

    if (!command) {
      logger.warn(`Command not found: ${resolvedCommandName}`);
      return; 
    }

    if (isMaintenanceMode() && !isBotOwner(message.author.id)) {
      await message.channel.send({
        embeds: [createEmbed({
          title: 'Maintenance Mode',
          description: getBotMessage('maintenanceMode'),
          color: 'warning',
        })],
      }).catch(() => {});
      return;
    }

    if (!isCommandCategoryEnabled(command.category)) {
      await message.channel.send({
        embeds: [createEmbed({
          title: 'Feature Disabled',
          description: getBotMessage('commandDisabled'),
          color: 'error',
        })],
      }).catch(() => {});
      return;
    }

    const restriction = getPrefixRestriction(command, args, resolveSubcommandAlias);
    if (!supportsPrefixExecution(command) || restriction.blocked) {
      if (restriction.blocked && restriction.reason) {
        const embed = createEmbed({
          title: 'Slash Command Only',
          description: `${restriction.reason}\nUse \`/${resolvedCommandName}\` instead.`,
          color: 'info',
        });
        await message.channel.send({ embeds: [embed] }).catch(() => {});
      }
      return;
    }

    if (!(await isCommandEnabled(client, message.guild.id, resolvePrefixAccessKey(command.data, args), command.category))) {
      const embed = createEmbed({
        title: 'Command Disabled',
        description: 'This command has been disabled for this server.',
        color: 'error',
      });
      await message.channel.send({ embeds: [embed] }).catch(() => {});
      return;
    }

    const mockInteractionForProtection = {
      guildId: message.guild.id,
      user: message.author,
    };
    const abuseProtection = await enforceAbuseProtection(
      mockInteractionForProtection,
      command,
      resolvedCommandName,
    );
    if (!abuseProtection.allowed) {
      const formattedCooldown = formatCooldownDuration(abuseProtection.remainingMs);
      const embed = createEmbed({
        title: 'Command Cooldown',
        description: `This command is on cooldown. Please wait ${formattedCooldown} before trying again.`,
        color: 'error',
      });
      await message.channel.send({ embeds: [embed] }).catch(() => {});
      return;
    }

    logger.info(`Executing prefix command: ${prefix}${commandName} (resolved to ${resolvedCommandName}) by ${message.author.tag}`);
    
    await executePrefixCommand(command, message, args, client, prefix, guildConfig);
  } catch (error) {
    logger.error('Error handling prefix command:', error);
  }
}

async function handleCountingGame(message, client) {
  try {
    const config = await getCountingGameConfig(client, message.guild.id);
    if (!config.enabled || !config.channelId || message.channel.id !== config.channelId) {
      return false;
    }

    const content = message.content.trim();
    const validCount = isValidCountingMessage(content, config);
    const invalidAttempt = !validCount || message.author.id === config.lastUserId;

    if (invalidAttempt) {
      await message.delete().catch(() => {});
      await saveCountingGameConfig(client, message.guild.id, {
        ...config,
        nextNumber: 1,
        lastUserId: null,
        currentStreak: 0,
      });

      const failureMessage = await message.channel.send(`❌ Count broken by <@${message.author.id}>. The sequence has been reset to **1**.`);
      setTimeout(() => {
        failureMessage.delete().catch(() => {});
      }, 10000);

      return true;
    }

    await recordCorrectCount(client, message.guild.id, message.author.id);
    return true;
  } catch (error) {
    logger.error('Error handling counting game:', error);
    return false;
  }
}

async function handleLeveling(message, client) {
  try {
    const rateLimitKey = `xp-event:${message.guild.id}:${message.author.id}`;
    const canProcess = await checkRateLimit(rateLimitKey, MESSAGE_XP_RATE_LIMIT_ATTEMPTS, MESSAGE_XP_RATE_LIMIT_WINDOW_MS);
    if (!canProcess) {
      return;
    }

    const levelingConfig = await getLevelingConfig(client, message.guild.id);
    
    if (!levelingConfig?.enabled) {
      return;
    }

    if (levelingConfig.ignoredChannels?.includes(message.channel.id)) {
      return;
    }

    if (levelingConfig.ignoredRoles?.length > 0) {
      const member = await message.guild.members.fetch(message.author.id).catch(() => {
        return null;
      });
      if (member && member.roles.cache.some(role => levelingConfig.ignoredRoles.includes(role.id))) {
        return;
      }
    }

    if (levelingConfig.blacklistedUsers?.includes(message.author.id)) {
      return;
    }

    if (!message.content || message.content.trim().length === 0) {
      return;
    }

    const userData = await getUserLevelData(client, message.guild.id, message.author.id);

    const cooldownTime = levelingConfig.xpCooldown || 60;
    const now = Date.now();
    const timeSinceLastMessage = now - (userData.lastMessage || 0);

    if (timeSinceLastMessage < cooldownTime * 1000) {
      return;
    }

    const minXP = levelingConfig.xpRange?.min || levelingConfig.xpPerMessage?.min || 15;
    const maxXP = levelingConfig.xpRange?.max || levelingConfig.xpPerMessage?.max || 25;

    const safeMinXP = Math.max(1, minXP);
    const safeMaxXP = Math.max(safeMinXP, maxXP);

    const xpToGive = Math.floor(Math.random() * (safeMaxXP - safeMinXP + 1)) + safeMinXP;

    let finalXP = xpToGive;
    if (levelingConfig.xpMultiplier && levelingConfig.xpMultiplier > 1) {
      finalXP = Math.floor(finalXP * levelingConfig.xpMultiplier);
    }

    const result = await addXp(client, message.guild, message.member, finalXP);

    if (result?.leveledUp) {
      logger.info(
        `${message.author.tag} leveled up to level ${result.level} in ${message.guild.name}`
      );
    }
  } catch (error) {
    logger.error('Error handling leveling for message:', error);
  }
}