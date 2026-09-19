import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const WELCOME_STICKY_CHANNEL_ID = '1504917892100001892';
const WELCOME_STICKY_MESSAGE = 'Make sure to check out <#1504948495948452001> <#1513625068239065158> <#1513625388503535657> <#1519838464374476991> <#1547003075108147210>';
const WELCOME_STICKY_ENABLED_KEY = (guildId) => 'guild:' + guildId + ':welcome-sticky-enabled';
const WELCOME_STICKY_MESSAGE_KEY = (guildId) => 'guild:' + guildId + ':welcome-sticky-message';

export default {
    data: new SlashCommandBuilder()
        .setName('welcome-sticky')
        .setDescription('Enable or disable the automatic welcome channel footer.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable the automatic welcome footer.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable the automatic welcome footer.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check whether the automatic welcome footer is enabled.')
        ),

    async execute(interaction, client) {
        if (!interaction.guild || !client?.db) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const enabledKey = WELCOME_STICKY_ENABLED_KEY(interaction.guild.id);
        const messageKey = WELCOME_STICKY_MESSAGE_KEY(interaction.guild.id);
        const channel = interaction.guild.channels.cache.get(WELCOME_STICKY_CHANNEL_ID);

        if (subcommand === 'status') {
            const enabled = await client.db.get(enabledKey, false);
            return interaction.reply({
                content: enabled
                    ? 'Welcome sticky is **enabled**.'
                    : 'Welcome sticky is **disabled**.',
                ephemeral: true,
            });
        }

        if (subcommand === 'disable') {
            await client.db.set(enabledKey, false);

            const oldMessageId = await client.db.get(messageKey, null);
            if (oldMessageId && channel?.isTextBased?.()) {
                const oldMessage = await channel.messages.fetch(oldMessageId).catch(() => null);
                if (oldMessage) await oldMessage.delete().catch(() => {});
            }
            await client.db.set(messageKey, null);

            return interaction.reply({
                content: 'Welcome sticky has been **disabled**.',
                ephemeral: true,
            });
        }

        if (!channel?.isTextBased?.()) {
            return interaction.reply({
                content: 'I could not find the welcome channel.',
                ephemeral: true,
            });
        }

        const permissions = channel.permissionsFor(interaction.guild.members.me);
        if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages])) {
            return interaction.reply({
                content: 'I need **View Channel**, **Send Messages**, and **Manage Messages** in the welcome channel.',
                ephemeral: true,
            });
        }

        const oldMessageId = await client.db.get(messageKey, null);
        if (oldMessageId) {
            const oldMessage = await channel.messages.fetch(oldMessageId).catch(() => null);
            if (oldMessage) await oldMessage.delete().catch(() => {});
        }

        const stickyMessage = await channel.send({
            content: WELCOME_STICKY_MESSAGE,
            allowedMentions: { parse: [] },
        });

        await client.db.set(messageKey, stickyMessage.id);
        await client.db.set(enabledKey, true);

        return interaction.reply({
            content: 'Welcome sticky has been **enabled**. TigerBot will automatically delete and resend it after every welcome message.',
            ephemeral: true,
        });
    },
};
