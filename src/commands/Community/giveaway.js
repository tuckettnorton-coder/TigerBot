import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { saveGiveaway, getGuildGiveaways } from '../../utils/giveaways.js';
import { createGiveawayEmbed, createGiveawayButtons, selectWinners } from '../../services/giveawayService.js';

function parseDuration(input) {
  const match = String(input || '').trim().toLowerCase().match(/^(\\d+)\\s*(s|m|h|d|w)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!amount) return null;
  return amount * ({s:1000,m:60000,h:3600000,d:86400000,w:604800000}[match[2]]);
}

async function finish(client, guildId, giveaway, reroll = false) {
  const winners = selectWinners(giveaway.participants || [], giveaway.winnerCount);
  giveaway.ended = true;
  giveaway.isEnded = true;
  giveaway.winnerIds = winners;
  giveaway.endedAt = new Date().toISOString();
  await saveGiveaway(client, guildId, giveaway);
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  const message = channel ? await channel.messages.fetch(giveaway.messageId).catch(() => null) : null;
  if (message) await message.edit({
    content: reroll ? 'GIVEAWAY REROLLED' : 'GIVEAWAY ENDED',
    embeds: [createGiveawayEmbed(giveaway, reroll ? 'reroll' : 'ended', winners)],
    components: [createGiveawayButtons(true)]
  });
  if (channel) await channel.send(winners.length
    ? 'Giveaway winner(s): ' + winners.map(id => '<@' + id + '>').join(', ') + ' — congratulations!'
    : 'The giveaway ended with no valid entries.');
  return winners;
}

export default {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create and manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('start').setDescription('Start a giveaway')
      .addStringOption(o => o.setName('duration').setDescription('30s, 10m, 2h, 1d, or 1w').setRequired(true))
      .addStringOption(o => o.setName('prize').setDescription('Giveaway prize').setRequired(true))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20).setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Giveaway channel').setRequired(false))
      .addStringOption(o => o.setName('description').setDescription('Optional description').setRequired(false)))
    .addSubcommand(s => s.setName('end').setDescription('End a giveaway').addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
    .addSubcommand(s => s.setName('reroll').setDescription('Reroll a giveaway').addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List active giveaways')),

  async execute(interaction, config, client) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'start') {
      const duration = parseDuration(interaction.options.getString('duration'));
      if (!duration) return interaction.reply({content:'Invalid duration. Use 30s, 10m, 2h, 1d, or 1w.', flags:MessageFlags.Ephemeral});
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const giveaway = {
        id:'gw-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
        guildId:interaction.guildId, channelId:channel.id, messageId:null,
        prize:interaction.options.getString('prize'),
        description:interaction.options.getString('description') || 'Click **Enter Giveaway** below to enter!',
        winnerCount:interaction.options.getInteger('winners'), participants:[], winnerIds:[],
        startedAt:new Date().toISOString(), endsAt:new Date(Date.now()+duration).toISOString(), ended:false
      };
      const message = await channel.send({embeds:[createGiveawayEmbed(giveaway)], components:[createGiveawayButtons(false)]});
      giveaway.messageId = message.id;
      await saveGiveaway(client, interaction.guildId, giveaway);
      return interaction.reply({content:'Giveaway started in <#' + channel.id + '>.', flags:MessageFlags.Ephemeral});
    }
    const giveaways = await getGuildGiveaways(client, interaction.guildId);
    if (sub === 'list') {
      const active = giveaways.filter(g => !g.ended && new Date(g.endsAt).getTime() > Date.now());
      const text = active.length ? active.map(g => '• ' + g.prize + ' — <#' + g.channelId + '> — <t:' + Math.floor(new Date(g.endsAt).getTime()/1000) + ':R> — ' + g.messageId).join('\\n') : 'There are no active giveaways.';
      return interaction.reply({content:text, flags:MessageFlags.Ephemeral});
    }
    const id = interaction.options.getString('message_id');
    const giveaway = giveaways.find(g => g.messageId === id);
    if (!giveaway) return interaction.reply({content:'Giveaway not found.', flags:MessageFlags.Ephemeral});
    if (sub === 'end' && giveaway.ended) return interaction.reply({content:'This giveaway has already ended.', flags:MessageFlags.Ephemeral});
    if (sub === 'reroll' && !giveaway.ended) return interaction.reply({content:'This giveaway has not ended yet.', flags:MessageFlags.Ephemeral});
    await finish(client, interaction.guildId, giveaway, sub === 'reroll');
    return interaction.reply({content:sub === 'reroll' ? 'Giveaway rerolled.' : 'Giveaway ended.', flags:MessageFlags.Ephemeral});
  }
};
