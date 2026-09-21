import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getAutoGiveaways, saveAutoGiveaway, removeAutoGiveaway } from '../../utils/giveaways.js';

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
    .addSubcommand(s => s.setName('stop').setDescription('Stop an automatic giveaway').addStringOption(o => o.setName('id').setDescription('Automatic giveaway ID').setRequired(true))),

  async execute(interaction, config, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const configs = await getAutoGiveaways(client, guildId);
    if (sub === 'create') {
      const durationMs = parseDuration(interaction.options.getString('duration'));
      const repeatMs = parseDuration(interaction.options.getString('repeat'));
      const endsText = interaction.options.getString('ends').trim().toLowerCase();
      const scheduleMs = endsText === 'never' ? null : parseDuration(endsText);
      if (!durationMs || !repeatMs || (!scheduleMs && endsText !== 'never')) return interaction.reply({content:'Invalid duration, repeat, or ends. Use 30s, 10m, 2h, 1d, 1w, or never.', flags:MessageFlags.Ephemeral});
      if (repeatMs < durationMs) return interaction.reply({content:'Repeat must be at least as long as the giveaway duration.', flags:MessageFlags.Ephemeral});
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const now = Date.now();
      const auto = {
        id:'auto-' + now + '-' + Math.random().toString(36).slice(2,7), guildId, channelId:channel.id,
        prize:interaction.options.getString('prize'), description:interaction.options.getString('description') || 'Click **Enter Giveaway** below to enter!',
        winnerCount:interaction.options.getInteger('winners'), durationMs, repeatMs,
        createdAt:new Date(now).toISOString(), scheduleEndsAt:scheduleMs ? new Date(now + scheduleMs).toISOString() : null,
        nextRunAt:new Date(now).toISOString(), enabled:true
      };
      await saveAutoGiveaway(client, guildId, auto);
      return interaction.reply({content:'Automatic giveaway created. ID: ' + auto.id + '\\nEach giveaway lasts ' + interaction.options.getString('duration') + ' and repeats every ' + interaction.options.getString('repeat') + '. Schedule ends: ' + endsText + '.', flags:MessageFlags.Ephemeral});
    }
    if (sub === 'list') {
      const active = configs.filter(c => c.enabled);
      const text = active.length ? active.map(c => '• ' + c.id + ' — ' + c.prize + ' — every ' + Math.round(c.repeatMs/60000) + 'm — next <t:' + Math.floor(new Date(c.nextRunAt).getTime()/1000) + ':R>').join('\\n') : 'There are no automatic giveaways.';
      return interaction.reply({content:text, flags:MessageFlags.Ephemeral});
    }
    const id = interaction.options.getString('id');
    if (!configs.some(c => c.id === id)) return interaction.reply({content:'Automatic giveaway not found.', flags:MessageFlags.Ephemeral});
    await removeAutoGiveaway(client, guildId, id);
    return interaction.reply({content:'Automatic giveaway stopped.', flags:MessageFlags.Ephemeral});
  }
};
