import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getAutoGiveaways, getGuildGiveaways, saveAutoGiveaway, removeAutoGiveaway, removeGiveaway } from '../../utils/giveaways.js';
import { Mutex } from '../../utils/mutex.js';

function parseDuration(input) {
  const match = String(input || '').trim().toLowerCase().match(/^(\d+)\s*(s|m|h|d|w)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!amount) return null;
  return amount * ({s:1000,m:60000,h:3600000,d:86400000,w:604800000}[match[2]]);
}

export default {
  data: new SlashCommandBuilder()
    .setName('auto-giveaway')
    .setDescription('Create and manage repeating giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('create').setDescription('Create a repeating giveaway')
      .addStringOption(o => o.setName('duration').setDescription('How long each giveaway runs').setRequired(true))
      .addStringOption(o => o.setName('prize').setDescription('Giveaway prize').setRequired(true))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20).setRequired(true))
      .addStringOption(o => o.setName('repeat').setDescription('How often it repeats, e.g. 1d').setRequired(true))
      .addStringOption(o => o.setName('ends').setDescription('When the schedule ends: 7d or never').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Giveaway channel').setRequired(false))
      .addStringOption(o => o.setName('description').setDescription('Optional description').setRequired(false)))
    .addSubcommand(s => s.setName('list').setDescription('List automatic giveaways'))
    .addSubcommand(s => s.setName('stop').setDescription('Stop an automatic giveaway').addStringOption(o => o.setName('id').setDescription('Automatic giveaway ID').setRequired(true)))
    .addSubcommand(s => s.setName('delete').setDescription('Delete an existing automatic giveaway')),

  async execute(interaction, config, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    if (sub === 'create') {
      const durationMs = parseDuration(interaction.options.getString('duration'));
      const repeatMs = parseDuration(interaction.options.getString('repeat'));
      const endsText = interaction.options.getString('ends').trim().toLowerCase();
      const scheduleMs = endsText === 'never' ? null : parseDuration(endsText);
      if (!durationMs || !repeatMs || (!scheduleMs && endsText !== 'never')) return interaction.reply({content:'Invalid duration, repeat, or ends. Use 30s, 10m, 2h, 1d, 1w, or never.', flags:MessageFlags.Ephemeral});
      if (repeatMs < durationMs) return interaction.reply({content:'Repeat must be at least as long as the giveaway duration.', flags:MessageFlags.Ephemeral});
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const prize = interaction.options.getString('prize').trim();
      const description = interaction.options.getString('description') || 'Click **Enter Giveaway** below to enter!';
      const winnerCount = interaction.options.getInteger('winners');

      // Serialize schedule creation per server and re-read storage while holding
      // the lock. Checking a stale snapshot allowed two near-simultaneous
      // interactions to create two schedules and therefore two first posts.
      return Mutex.runExclusive(`auto-giveaway-configs:${guildId}`, async () => {
        const configs = await getAutoGiveaways(client, guildId);
        const duplicate = configs.find(existing =>
          existing.enabled !== false
          && String(existing.channelId) === String(channel.id)
          && String(existing.prize || '').trim().toLowerCase() === prize.toLowerCase()
        );

        if (duplicate) {
          return interaction.reply({
            content: '⚠️ An active automatic giveaway for this prize already exists in that channel (ID: ' + duplicate.id + '). I did not create another one. Use /auto-giveaway list to review your schedules.',
            flags: MessageFlags.Ephemeral,
          });
        }

        const now = Date.now();
        const auto = {
          id: 'auto-' + now + '-' + Math.random().toString(36).slice(2, 7),
          guildId,
          channelId: channel.id,
          prize,
          description,
          winnerCount,
          durationMs,
          repeatMs,
          createdAt: new Date(now).toISOString(),
          scheduleEndsAt: scheduleMs ? new Date(now + scheduleMs).toISOString() : null,
          nextRunAt: new Date(now).toISOString(),
          enabled: true,
        };

        await saveAutoGiveaway(client, guildId, auto);
        return interaction.reply({
          content: 'Automatic giveaway created. ID: ' + auto.id + '\\nEach giveaway lasts ' + interaction.options.getString('duration') + ' and repeats every ' + interaction.options.getString('repeat') + '. Schedule ends: ' + endsText + '.',
          flags: MessageFlags.Ephemeral,
        });
      });
    }
    const configs = await getAutoGiveaways(client, guildId);
    if (sub === 'delete') {
      const active = configs.filter(c => c.enabled);
      if (!active.length) return interaction.reply({content:'There are no active automatic giveaways.', flags:MessageFlags.Ephemeral});
      const { StringSelectMenuBuilder, ActionRowBuilder } = await import('discord.js');
      const menu = new StringSelectMenuBuilder()
        .setCustomId('auto_giveaway_delete_select')
        .setPlaceholder('Select an automatic giveaway to delete')
        .addOptions(active.slice(0,25).map(c => ({
          label: String(c.prize || 'Automatic Giveaway').slice(0,100),
          description: ('Stop and delete ' + c.id).slice(0,100),
          value: c.id
        })));
      const reply = await interaction.reply({
        content: 'Select the automatic giveaway you want to delete. This will stop it completely and remove its active giveaway messages.',
        components: [new ActionRowBuilder().addComponents(menu)],
        flags: MessageFlags.Ephemeral,
        fetchReply: true
      });
      const collector = reply.createMessageComponentCollector({time: 60000, filter: i => i.user.id === interaction.user.id});
      collector.on('collect', async i => {
        const selected = active.find(c => c.id === i.values[0]);
        if (!selected) return i.update({content:'Automatic giveaway not found.', components:[]});
        await Mutex.runExclusive(`auto-giveaway-configs:${guildId}`, () => removeAutoGiveaway(client, guildId, selected.id));
        const giveawayList = await getGuildGiveaways(client, guildId);
        const related = giveawayList.filter(g => g.autoGiveawayId === selected.id);
        for (const g of related) {
          const channel = await client.channels.fetch(g.channelId).catch(() => null);
          const message = channel && g.messageId
            ? await channel.messages.fetch(g.messageId).catch(() => null)
            : null;
          if (message) await message.delete().catch(() => null);
          if (g.messageId) await removeGiveaway(client, guildId, g.messageId);
        }
        await i.update({content:'Automatic giveaway deleted completely and stopped.', components:[]});
        collector.stop();
      });
      collector.on('end', async (_, reason) => {
        if (reason === 'time') await interaction.editReply({content:'Automatic giveaway delete selection expired.', components:[]}).catch(() => null);
      });
      return;
    }
    if (sub === 'list') {
      const active = configs.filter(c => c.enabled);
      const text = active.length ? active.map(c => '• ' + c.id + ' — ' + c.prize + ' — every ' + Math.round(c.repeatMs/60000) + 'm — next <t:' + Math.floor(new Date(c.nextRunAt).getTime()/1000) + ':R>').join('\\n') : 'There are no automatic giveaways.';
      return interaction.reply({content:text, flags:MessageFlags.Ephemeral});
    }
    const id = interaction.options.getString('id');
    if (!configs.some(c => c.id === id)) return interaction.reply({content:'Automatic giveaway not found.', flags:MessageFlags.Ephemeral});
    await Mutex.runExclusive(`auto-giveaway-configs:${guildId}`, () => removeAutoGiveaway(client, guildId, id));
    return interaction.reply({content:'Automatic giveaway stopped.', flags:MessageFlags.Ephemeral});
  }
};
