import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { sanitizeMarkdown } from '../../utils/validation.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
export default {
    data: new SlashCommandBuilder()
        .setName("dm")
        .setDescription("Send a direct message to a user (Staff only)")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user to send a DM to individually")
                .setRequired(false)
        )
        .addRoleOption(option =>
            option
                .setName("role")
                .setDescription("Send the DM to everyone with this role")
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("message")
                .setDescription("The message to send")
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option
                .setName("anonymous")
                .setDescription("Send the message anonymously (default: false)")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`DM interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'dm'
            });
            return;
        }

    const targetUser = interaction.options.getUser("user");
        const targetRole = interaction.options.getRole("role");
        const message = interaction.options.getString("message");
        const anonymous = interaction.options.getBoolean("anonymous") || false;

        try {
            if (!targetUser && !targetRole) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'You must select either a user or a role.' });
            }

            if (targetUser && targetRole) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Please select either a user or a role, not both.' });
            }

            if (message.length > 2000) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Messages must be under 2000 characters.' });
            }

            const sanitized = sanitizeMarkdown(message);
            const embed = successEmbed(
                anonymous ? "Message from the Staff Team" : `Message from ${interaction.user.tag}`,
                sanitized
            ).setFooter({
                text: `You cannot reply to this message. | Logger ID: ${interaction.id}`
            });

            if (targetUser) {
                if (targetUser.bot) {
                    return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'You cannot send DMs to bot accounts.' });
                }

                const dmChannel = await targetUser.createDM();
                await dmChannel.send({ embeds: [embed] });

                await logEvent({
                    client: interaction.client,
                    guild: interaction.guild,
                    event: {
                        action: "DM Sent",
                        target: `${targetUser.tag} (${targetUser.id})`,
                        executor: `${interaction.user.tag} (${interaction.user.id})`,
                        reason: `Anonymous: ${anonymous ? 'Yes' : 'No'}`,
                        metadata: {
                            userId: targetUser.id,
                            moderatorId: interaction.user.id,
                            anonymous,
                            messageLength: sanitized.length
                        }
                    }
                });

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed("DM Sent", `Successfully sent a message to ${targetUser.tag}`)],
                });
            }

            const members = await interaction.guild.members.fetch();
            const roleMembers = members.filter(member => member.roles.cache.has(targetRole.id) && !member.user.bot);

            if (roleMembers.size === 0) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `No non-bot members were found with the ${targetRole.name} role.` });
            }

            let sent = 0;
            let failed = 0;

            for (const member of roleMembers.values()) {
                try {
                    const dmChannel = await member.user.createDM();
                    await dmChannel.send({ embeds: [embed] });
                    sent++;

                    await logEvent({
                        client: interaction.client,
                        guild: interaction.guild,
                        event: {
                            action: "DM Sent",
                            target: `${member.user.tag} (${member.user.id})`,
                            executor: `${interaction.user.tag} (${interaction.user.id})`,
                            reason: `Role: ${targetRole.name} | Anonymous: ${anonymous ? 'Yes' : 'No'}`,
                            metadata: {
                                userId: member.user.id,
                                roleId: targetRole.id,
                                moderatorId: interaction.user.id,
                                anonymous,
                                messageLength: sanitized.length
                            }
                        }
                    });
                } catch (dmError) {
                    failed++;
                    logger.warn(`Could not send role DM to ${member.user.tag}`, { error: dmError.message, userId: member.user.id, roleId: targetRole.id });
                }
            }

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "Role DM Complete",
                        `Successfully sent the DM to **${sent}** member(s) with the ${targetRole} role.${failed ? ` Failed to send to **${failed}** member(s), usually because their DMs are disabled.` : ''}`
                    ),
                ],
            });
        } catch (error) {
            logger.error('DM command error:', error);
            
if (error.code === 50007) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Could not send a DM to ${targetUser.tag}. They may have DMs disabled.` });
            }
            
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Failed to send DM: ${error.message}` });
        }
    }
};