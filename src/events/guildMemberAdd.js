import { Events, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getColor, botConfig } from '../config/bot.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
import { getWelcomeConfig } from '../utils/database.js';
import { formatWelcomeMessage } from '../utils/welcome.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { getServerCounters, updateCounter } from '../services/serverstatsService.js';
import { setBirthday as dbSetBirthday } from '../utils/database.js';
import { logger } from '../utils/logger.js';
const WELCOME_STICKY_CHANNEL_ID = '1504917892100001892';
const WELCOME_STICKY_MESSAGE = 'Make sure to check out <#1504948495948452001> <#1513625068239065158> <#1513625388503535657> <#1519838464374476991> <#1547003075108147210>';
const WELCOME_STICKY_KEY = (guildId) => 'guild:' + guildId + ':welcome-sticky-message';
const WELCOME_STICKY_ENABLED_KEY = (guildId) => 'guild:' + guildId + ':welcome-sticky-enabled';

async function keepWelcomeMessageAtBottom(channel, client) {
    if (!channel || channel.id !== WELCOME_STICKY_CHANNEL_ID || !client?.db) return;

    try {
        const me = channel.guild?.members?.me;
        const permissions = me ? channel.permissionsFor(me) : null;
        if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages])) {
            logger.warn('Welcome sticky cannot refresh because TigerBot is missing View Channel, Send Messages, or Manage Messages in the welcome channel.');
            return;
        }

        const oldMessageId = await client.db.get(WELCOME_STICKY_KEY(channel.guild.id), null);
        if (oldMessageId) {
            const oldMessage = await channel.messages.fetch(oldMessageId).catch(() => null);
            if (oldMessage) {
                await oldMessage.delete().catch((error) => {
                    logger.warn('Welcome sticky could not delete the previous sticky message:', error);
                });
            }
        }

        const stickyMessage = await channel.send({
            content: WELCOME_STICKY_MESSAGE,
            allowedMentions: { parse: [] },
        });

        await client.db.set(WELCOME_STICKY_KEY(channel.guild.id), stickyMessage.id);
        logger.info('Welcome sticky refreshed in #' + channel.name + ' after a welcome message.');
    } catch (error) {
        logger.error('Could not keep welcome channel message at bottom:', error);
    }
}

function scheduleWelcomeStickyRefresh(channel, client) {
    if (!channel?.isTextBased?.() || !client?.db) return;

    // TicketBot may send its welcome message shortly after TigerBot receives
    // GuildMemberAdd, so retry after the welcome message has had time to arrive.
    for (const delay of [1000, 3000, 6000, 10000]) {
        const timeout = setTimeout(async () => {
            try {
                const enabled = await client.db.get(WELCOME_STICKY_ENABLED_KEY(channel.guild.id), false);
                if (!enabled) return;

                const recent = await channel.messages.fetch({ limit: 10 }).catch(() => null);
                const newestNonTigerBotMessage = recent
                    ? [...recent.values()]
                        .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
                        .find(message => message.author?.id !== client.user?.id)
                    : null;

                const stickyId = await client.db.get(WELCOME_STICKY_KEY(channel.guild.id), null);
                const currentSticky = stickyId
                    ? await channel.messages.fetch(stickyId).catch(() => null)
                    : null;

                // Only refresh when a newer non-TigerBot message actually arrived.
                if (newestNonTigerBotMessage &&
                    (!currentSticky || newestNonTigerBotMessage.createdTimestamp > currentSticky.createdTimestamp)) {
                    await keepWelcomeMessageAtBottom(channel, client);
                }
            } catch (error) {
                logger.error('Welcome sticky scheduled refresh failed:', error);
            }
        }, delay);

        if (typeof timeout.unref === 'function') {
            timeout.unref();
        }
    }
}

export default {
  name: Events.GuildMemberAdd,
  once: false,
  
  async execute(member) {
    try {
        const { guild, user } = member;
        
        const config = await getGuildConfig(member.client, guild.id);
        
        const welcomeConfig = await getWelcomeConfig(member.client, guild.id);
        
        const welcomeChannelId = welcomeConfig?.channelId;
        const channel = welcomeChannelId ? guild.channels.cache.get(welcomeChannelId) : null;

        if (welcomeConfig?.enabled && welcomeChannelId) {
            const me = guild.members.me;
            const permissions = channel?.isTextBased?.() && me ? channel.permissionsFor(me) : null;
            // Skip only the welcome message if permissions are missing; the rest of the
            // join pipeline (auto-role, verification, logging, counters) must still run.
            if (permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
                const formatData = { user, guild, member };
                const welcomeMessage = formatWelcomeMessage(
                    welcomeConfig.welcomeMessage || welcomeConfig.welcomeEmbed?.description || botConfig.welcome?.defaultWelcomeMessage || 'Welcome {user} to {server}!',
                    formatData
                );

                const messageContent = welcomeConfig.welcomePing ? user.toString() : null;

                const embedTitle = formatWelcomeMessage(
                    welcomeConfig.welcomeEmbed?.title || '🎉 Welcome!',
                    formatData
                );
                const embedFooter = welcomeConfig.welcomeEmbed?.footer
                    ? formatWelcomeMessage(welcomeConfig.welcomeEmbed.footer, formatData)
                    : `Welcome to ${guild.name}!`;

                const canEmbed = permissions.has(PermissionFlagsBits.EmbedLinks);

                if (!canEmbed) {
                    await channel.send({
                        content: messageContent || welcomeMessage
                    });
                } else {
                    const embed = new EmbedBuilder()
                        .setColor(welcomeConfig.welcomeEmbed?.color || getColor('success'))
                        .setTitle(embedTitle)
                        .setDescription(welcomeMessage)
                        .setThumbnail(user.displayAvatarURL())
                        .addFields(
                            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                            { name: 'Member Count', value: guild.memberCount.toString(), inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: embedFooter });
                    
                    if (welcomeConfig.welcomeImage) {
                        embed.setImage(welcomeConfig.welcomeImage);
                    } else if (welcomeConfig.welcomeEmbed?.image?.url) {
                        embed.setImage(welcomeConfig.welcomeEmbed.image.url);
                    }
                    
                    await channel.send({ 
                        content: messageContent,
                        embeds: [embed] 
                    });
                }
            }
        }
        
        // Automatically replace the footer after every welcome message, keeping it last.
        // Refresh the footer only after it has been enabled with /welcome-sticky enable.
        const stickyEnabled = await member.client.db.get(WELCOME_STICKY_ENABLED_KEY(guild.id), false);
        const stickyWelcomeChannel = guild.channels.cache.get(WELCOME_STICKY_CHANNEL_ID);
        if (stickyEnabled && stickyWelcomeChannel?.isTextBased?.()) {
            await keepWelcomeMessageAtBottom(stickyWelcomeChannel, member.client);
            scheduleWelcomeStickyRefresh(stickyWelcomeChannel, member.client);
        }\n        \n        if (welcomeConfig?.roleIds && welcomeConfig.roleIds.length > 0) {
            const delay = welcomeConfig.autoRoleDelay || 0;
            const singleRoleId = welcomeConfig.roleIds[0];
            
            if (delay > 0) {
                const timeout = setTimeout(async () => {
                    const role = guild.roles.cache.get(singleRoleId);
                    if (role) {
                        await assignRoleSafely(member, role);
                    }
                }, delay * 1000);
                if (typeof timeout.unref === 'function') {
                    timeout.unref();
                }
            } else {
                const role = guild.roles.cache.get(singleRoleId);
                if (role) {
                    await assignRoleSafely(member, role);
                }
            }
        }
        
        if (config?.verification?.enabled || config?.verification?.autoVerify?.enabled) {
            await handleVerification(member, guild, config.verification, member.client);
        }

        try {
            await logEvent({
                client: member.client,
                guildId: guild.id,
                eventType: EVENT_TYPES.MEMBER_JOIN,
                data: {
                    title: 'User joined',
                    lines: [
                        `**User:** ${user.toString()} (${user.displayName !== user.username ? `@${user.displayName}` : user.tag})`,
                        `**ID:** \`${user.id}\``,
                        `**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
                        `**Members:** ${guild.memberCount}`,
                    ],
                    quoted: false,
                    thumbnail: user.displayAvatarURL({ dynamic: true }),
                    userId: user.id,
                }
            });
        } catch (error) {
            logger.debug('Error logging member join:', error);
        }

        try {
            const counters = await getServerCounters(member.client, guild.id);
            for (const counter of counters) {
                if (counter && counter.type && counter.channelId && counter.enabled !== false) {
                    await updateCounter(member.client, guild, counter);
                }
            }
        } catch (error) {
            logger.debug('Error updating counters on member join:', error);
        }

        try {
            const backupKey = `guild:${guild.id}:birthdays:left`;
            const backup = (await member.client.db.get(backupKey)) || {};
            if (backup[user.id]) {
                const { month, day } = backup[user.id];
                await dbSetBirthday(member.client, guild.id, user.id, month, day);
                delete backup[user.id];
                await member.client.db.set(backupKey, backup);
                logger.debug(`Birthday restored for user ${user.id} in guild ${guild.id}`);
            }
        } catch (error) {
            logger.debug('Error restoring birthday on member join:', error);
        }
        
    } catch (error) {
        logger.error('Error in guildMemberAdd event:', error);
    }
  }
};

async function handleVerification(member, guild, verificationConfig, client) {
    const { autoVerifyOnJoin } = await import('../services/verificationService.js');
    
    try {
        const result = await autoVerifyOnJoin(client, guild, member, verificationConfig);
        
        if (result.autoVerified) {
            logger.info('User auto-verified on join', {
                guildId: guild.id,
                userId: member.id,
                userTag: member.user.tag,
                roleName: result.roleName,
                criteria: result.criteria
            });
        } else {
            logger.debug('User not auto-verified on join', {
                guildId: guild.id,
                userId: member.id,
                reason: result.reason
            });
        }

    } catch (error) {
        logger.error('Error in auto-verification for member', {
            guildId: guild.id,
            userId: member.id,
            userTag: member.user.tag,
            error: error.message
        });
    }
}

async function assignRoleSafely(member, role) {
    try {
        await member.roles.add(role);
    } catch (error) {
        logger.warn(`Failed to assign role ${role.id} to member ${member.id}:`, error);
    }
}