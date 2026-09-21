import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed } from '../utils/embeds.js';

const rateLimits = new Map();

export function isUserRateLimited(userId, messageId, cooldownMs = 1500) {
  const key = userId + ':' + messageId;
  const now = Date.now();
  const last = rateLimits.get(key) || 0;
  if (now - last < cooldownMs) return true;
  rateLimits.set(key, now);
  return false;
}

export function recordUserInteraction(userId, messageId) {
  rateLimits.set(userId + ':' + messageId, Date.now());
}

export function selectWinners(participants = [], winnerCount = 1) {
  const pool = [...new Set(participants)].sort(() => Math.random() - 0.5);
  return pool.slice(0, Math.max(1, Math.min(Number(winnerCount) || 1, pool.length)));
}

export function createGiveawayEmbed(giveaway, status = 'active', winners = []) {
  const ended = status === 'ended' || status === 'reroll';
  const ids = winners.length ? winners : (giveaway.winnerIds || []);
  const winnerText = ids.length ? ids.map(id => '<@' + id + '>').join(', ') : 'No valid winners';
  const fields = [
    { name: 'Prize', value: giveaway.prize || 'Mystery Prize', inline: true },
    { name: 'Winners', value: String(giveaway.winnerCount || 1), inline: true },
    { name: 'Entries', value: String((giveaway.participants || []).length), inline: true }
  ];
  if (!ended) fields.push({ name: 'Ends', value: '<t:' + Math.floor(new Date(giveaway.endsAt).getTime() / 1000) + ':R>', inline: false });
  else fields.push({ name: 'Winner(s)', value: winnerText, inline: false });
  return createEmbed({
    title: ended ? (status === 'reroll' ? 'Giveaway Rerolled' : 'Giveaway Ended') : 'Giveaway',
    description: giveaway.description || 'Click **Enter Giveaway** below to enter!',
    color: ended ? 'success' : 'primary',
    fields
  });
}

export function createGiveawayButtons(ended = false) {
  const row = new ActionRowBuilder();
  if (!ended) {
    row.addComponents(
      new ButtonBuilder().setCustomId('giveaway_join').setLabel('Enter Giveaway').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('giveaway_end').setLabel('End Giveaway').setStyle(ButtonStyle.Danger)
    );
  } else {
    row.addComponents(
      new ButtonBuilder().setCustomId('giveaway_reroll').setLabel('Reroll').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('giveaway_view').setLabel('View Winners').setStyle(ButtonStyle.Primary)
    );
  }
  return row;
}
