import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';

const GIVEAWAY_RULES_CHANNEL_ID = '1513947221815590932';
const RULES_TITLE = '🎉 Giveaway Information';
const CLAIM_ROLE_ID = '1513948994898759911';
const DAILY_CHANNEL_ID = '1505767690889859072';
const BIG_CHANNEL_ID = '1505768396221054976';
const QUICK_CHANNEL_ID = '1505768034718060644';

// The latest posted rules message is tracked in memory. Running the command again
// deletes that message and posts the newly configured version.
let lastRulesMessageId = null;

function buildRulesMessage({ dailyTime, bigTime, quickTime, payoutTime, sosRule, fakeClaimAction, pingRule }) {
    return `# 🎉 Giveaway Information

## ⏰ Giveaway Claim Times

**Daily Giveaways — ${dailyTime}**
<#${DAILY_CHANNEL_ID}>

**Big Giveaways — ${bigTime}**
<#${BIG_CHANNEL_ID}>

**Quick Drops — ${quickTime}**
<#${QUICK_CHANNEL_ID}>

Claim times may vary depending on the giveaway.

## 📥 How to Claim

• Open a ticket and send a screenshot showing you were pinged in the giveaway ending message.

## 📜 Rules

${fakeClaimAction}

${pingRule}

Giveaway prizes are usually paid out within **${payoutTime}**, but may take longer.

${sosRule}`;
}

export default {
    data: new SlashCommandBuilder()
        .setName('giveawayrulesupdate')
        .setDescription('Update and repost the giveaway rules information.')
        .addStringOption(option => option
            .setName('daily_time')
            .setDescription('Daily giveaway claim time, e.g. 24 Hours')
            .setRequired(false))
        .addStringOption(option => option
            .setName('big_time')
            .setDescription('Big giveaway claim time, e.g. 6 Hours')
            .setRequired(false))
        .addStringOption(option => option
            .setName('quick_time')
            .setDescription('Quick drop claim time, e.g. 1 Hour')
            .setRequired(false))
        .addStringOption(option => option
            .setName('payout_time')
            .setDescription('Normal prize payout time, e.g. 3–5 days')
            .setRequired(false))
        .addStringOption(option => option
            .setName('fake_claim_action')
            .setDescription('Action for fake or edited claim screenshots')
            .setRequired(false))
        .addStringOption(option => option
            .setName('ping_rule')
            .setDescription('Rule for pinging people in claim tickets')
            .setRequired(false))
        .addStringOption(option => option
            .setName('sos_rule')
            .setDescription('SOS giveaway rule')
            .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

        if (!interaction.inGuild()) {
            throw new TitanBotError(
                'Giveaway rules command used outside guild',
                ErrorTypes.VALIDATION,
                'This command can only be used in a server.',
                { userId: interaction.user.id }
            );
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            throw new TitanBotError(
                'User lacks ManageGuild permission for giveaway rules update',
                ErrorTypes.PERMISSION,
                "You need the 'Manage Server' permission to use this command.",
                { userId: interaction.user.id, guildId: interaction.guildId }
            );
        }

        const targetChannel = await interaction.guild.channels.fetch(GIVEAWAY_RULES_CHANNEL_ID);
        if (!targetChannel || !targetChannel.isTextBased()) {
            throw new TitanBotError(
                'Giveaway rules channel unavailable',
                ErrorTypes.VALIDATION,
                'The configured giveaway rules channel could not be found or is not a text channel.',
                { channelId: GIVEAWAY_RULES_CHANNEL_ID, guildId: interaction.guildId }
            );
        }

        const options = interaction.options;
        const dailyTime = options.getString('daily_time') || '24 Hours';
        const bigTime = options.getString('big_time') || '6 Hours';
        const quickTime = options.getString('quick_time') || '1 Hour';
        const payoutTime = options.getString('payout_time') || '3–5 days';
        const fakeClaimAction = options.getString('fake_claim_action') || `Fake or edited claim screenshots will result in you receiving <@&${CLAIM_ROLE_ID}>.`;
        const pingRule = options.getString('ping_rule') || 'Pinging anyone in your claim ticket = **NO PAY.**';
        const sosRule = options.getString('sos_rule') || 'For SOS giveaways, if not everyone claims, **nobody wins.**';

        // Delete the previously posted rules message, if this bot instance knows it.
        if (lastRulesMessageId) {
            try {
                const oldMessage = await targetChannel.messages.fetch(lastRulesMessageId);
                await oldMessage.delete();
            } catch (error) {
                // The old message may already have been deleted manually; continue.
                logger.debug(`Could not delete previous giveaway rules message ${lastRulesMessageId}: ${error?.message || error}`);
            }
        }

        const content = buildRulesMessage({
            dailyTime,
            bigTime,
            quickTime,
            payoutTime,
            sosRule,
            fakeClaimAction,
            pingRule
        });

        const message = await targetChannel.send({ content });
        lastRulesMessageId = message.id;

        logger.info(`Giveaway rules update posted by ${interaction.user.tag} to channel ${GIVEAWAY_RULES_CHANNEL_ID}; message ${message.id}`);

        await interaction.editReply({
            content: `✅ Giveaway rules updated in <#${GIVEAWAY_RULES_CHANNEL_ID}>. The previous bot-posted rules message was replaced.`
        });
    }
};
