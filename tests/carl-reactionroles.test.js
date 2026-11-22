import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCarlEmoji, parseCarlRoleLine, recoverCarlPanel, handleCarlReactionChange } from '../src/services/carlReactionRoles.js';

test('parses every Tiger Market ping role from one multiline setup message', () => {
  const lines = [
    '🎉 Giveaway Ping',
    '📢 Announcement Ping',
    '🎬 Media Ping',
    '🎲 Gambling Ping',
    '📦 Schematic Ping',
    '💀 Spawner Ping',
    '👷 Service Update Ping',
    '🤝 Partner Ping',
    '🤯 Community Scam/Vouch Ping',
    '🎯 Event Ping',
    '❌ No Pings',
    '🔴 Stream Ping',
  ];
  const parsed = lines.map(parseCarlRoleLine);
  assert.equal(parsed.length, 12);
  assert.ok(parsed.every(Boolean));
  assert.deepEqual(parsed.map(item => item.roleInput), [
    'Giveaway Ping', 'Announcement Ping', 'Media Ping', 'Gambling Ping',
    'Schematic Ping', 'Spawner Ping', 'Service Update Ping', 'Partner Ping',
    'Community Scam/Vouch Ping', 'Event Ping', 'No Pings', 'Stream Ping',
  ]);
});

test('recognizes Discord custom emoji and ordinary Unicode emoji', () => {
  assert.equal(normalizeCarlEmoji('<:coin:123456789012345678>'), '123456789012345678');
  assert.equal(normalizeCarlEmoji('<a:coin:123456789012345678>'), '123456789012345678');
  assert.equal(normalizeCarlEmoji('🎉'), '🎉');
});

test('rejects malformed role-pair entries', () => {
  assert.equal(parseCarlRoleLine(''), null);
  assert.equal(parseCarlRoleLine('🎉'), null);
  assert.deepEqual(parseCarlRoleLine('🤯 @Community Scam/Vouch Ping'), {
    emoji: '🤯',
    roleInput: '@Community Scam/Vouch Ping',
  });
});


test('recovers and uses an existing bot-authored 12-role panel after stored mapping is missing', async () => {
  const guildId = '123456789012345678';
  const channelId = '223456789012345678';
  const messageId = '323456789012345678';
  const botId = '423456789012345678';
  const userId = '523456789012345678';
  const roleNames = [
    'Giveaway Ping', 'Announcements ping', 'Media Ping', 'Gambling Ping',
    'Schematic Ping', 'Spawner Ping', 'Service Update Ping', 'Partner Ping',
    'Community Scam Vouch Ping', 'Event Ping', 'No ping', 'Stream Ping',
  ];
  const emojis = ['🎉', '📢', '🎬', '🎲', '📦', '💀', '👷', '🤝', '🤯', '🎯', '❌', '🔴'];
  const roles = new Map(roleNames.map((name, index) => {
    const id = (100000000000000000n + BigInt(index)).toString();
    return [id, { id, name, position: 1, managed: false, permissions: { has: () => false } }];
  }));
  const assigned = new Map();
  const member = {
    roles: {
      cache: assigned,
      add: async role => assigned.set(role.id, role),
      remove: async role => assigned.delete(role.id),
    },
  };
  const bot = {
    permissions: { has: () => true },
    roles: { highest: { position: 10 } },
  };
  const guild = {
    id: guildId,
    roles: {
      cache: roles,
      fetch: async roleId => roles.get(roleId) || null,
    },
    members: {
      fetch: async () => member,
      fetchMe: async () => bot,
    },
  };
  const description = emojis.map((emoji, index) =>
    emoji + ' <@&' + [...roles.keys()][index] + '>'
  ).join('\n');
  const reactions = new Map();
  reactions.find = () => undefined;
  const message = {
    guild, guildId, channelId, id: messageId,
    author: { id: botId },
    embeds: [{ description, footer: { text: 'React to add a role; remove your reaction to remove the role.' } }],
    reactions: { cache: reactions },
  };
  const store = new Map();
  const client = {
    user: { id: botId },
    db: {
      get: async key => store.get(key) ?? null,
      set: async (key, value) => { store.set(key, value); return true; },
    },
  };
  const key = 'guild:' + guildId + ':carl_reaction_roles:' + messageId;
  const recovered = await recoverCarlPanel(message, client);
  assert.equal(recovered.entries.length, 12);
  assert.equal(store.get(key).entries[1].roleName, 'Announcements ping');
  store.delete(key);

  const reaction = emoji => ({ message, emoji: { id: null, name: emoji } });
  const user = { id: userId, bot: false };
  await handleCarlReactionChange(reaction('🎉'), user, client, true);
  assert.ok(store.has(key), 'reaction should restore the missing mapping');
  assert.ok(assigned.has(recovered.entries[0].roleId), 'giveaway reaction should assign its role');

  await handleCarlReactionChange(reaction('🎉'), user, client, false);
  assert.ok(!assigned.has(recovered.entries[0].roleId), 'unreact should remove the role');

  await handleCarlReactionChange(reaction('🎉'), user, client, true);
  await handleCarlReactionChange(reaction('❌'), user, client, true);
  assert.ok(assigned.has(recovered.entries[10].roleId));
  assert.ok(!assigned.has(recovered.entries[0].roleId), 'No ping should clear Giveaway Ping');

  await handleCarlReactionChange(reaction('🔴'), user, client, true);
  assert.ok(assigned.has(recovered.entries[11].roleId));
  assert.ok(!assigned.has(recovered.entries[10].roleId), 'Stream Ping should clear No ping');
});
