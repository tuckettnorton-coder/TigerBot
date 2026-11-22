import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCarlEmoji, parseCarlRoleLine } from '../src/services/carlReactionRoles.js';

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
