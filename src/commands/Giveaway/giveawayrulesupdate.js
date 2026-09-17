import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';

const GIVEAWAY_RULES_CHANNEL_ID = '1513947221815590932';

const GIVEAWAY_RULES_MESSAGE = `# 🎉 Giveaway Information

## ⏰ Giveaway Claim Times

**Daily Giveaways — 24 Hours**
<#1505767690889859072>

**Big Giveaways — 6 Hours**
<#1505768396221054976>

**Quick Drops — 1 Hour**
<#1505768034718060644>

Claim times may vary depending on the giveaway.

## 📥 How to Claim

• Open a ticket and send a screenshot showing you were pinged in the giveaway ending message.

## 📜 Rules

Fake or edited claim screenshots will result in you receiving <@&1513948994898759911>.

Pinging anyone in your claim ticket = NO PAY.

Giveaway prizes are usually paid out within 3–5 days, but may take longer.

For SOS giveaways, if not everyone claims, nobody wins.`;

export default {
    data: new SlashCommandBuilder()
        .setName('giveawayrulesupdate')
        .setDescription('Posts the current giveaway rules in the giveaway information channel.')
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

        const message = await targetChannel.send({ content: GIVEAWAY_RULES_MESSAGE });

        logger.info(`Giveaway rules update posted by ${interaction.user.tag} to channel ${GIVEAWAY_RULES_CHANNEL_ID}`);

        await interaction.editReply({
            content: `✅ Giveaway rules update posted in <#${GIVEAWAY_RULES_CHANNEL_ID}>.\nMessage ID: ${message.id}`
        });
    }
};
