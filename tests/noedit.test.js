import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findEditedLink,
  isNoEditEnabled,
  enforceNoEditOnUpdate,
  NO_EDIT_EXEMPT_ROLE_IDS,
} from '../src/services/noEditService.js';

function scenario({ before = 'hello', after = 'hello https://example.com', roles = [], enabled = true } = {}) {
  let deleted = 0;
  const client = { db: { get: async () => ({ enabled }) } };
  const member = { roles: { cache: { has: (id) => roles.includes(id) } } };
  const guild = { id: 'guild-1', members: { fetch: async () => member } };
  const oldMessage = { content: before, author: { id: 'user-1', bot: false } };
  const newMessage = {
    id: 'message-1',
    guild,
    client,
    member,
    author: { id: 'user-1', bot: false },
    channelId: 'channel-1',
    content: after,
    delete: async () => { deleted += 1; },
  };
  return { client, oldMessage, newMessage, deleted: () => deleted };
}

test('detects ordinary, invite, markdown and bare-domain links', () => {
  assert.ok(findEditedLink('https://malicious.example/path'));
  assert.ok(findEditedLink('visit www.example.com'));
  assert.ok(findEditedLink('discord.gg/abc123'));
  assert.ok(findEditedLink('[click](https://example.com)'));
  assert.ok(findEditedLink('the site example.com is here'));
  assert.equal(findEditedLink('hello, this is just a normal edited message'), null);
});

test('the protection defaults to enabled when no setting exists', async () => {
  assert.equal(await isNoEditEnabled({ db: { get: async (_key, fallback) => fallback } }, 'guild-1'), true);
});

test('deletes edited links from ordinary members', async () => {
  const s = scenario();
  assert.equal(await enforceNoEditOnUpdate(s.oldMessage, s.newMessage), true);
  assert.equal(s.deleted(), 1);
  assert.equal(s.client.noEditRecentlyDeleted.has('message-1'), true);
  s.client.noEditRecentlyDeleted.delete('message-1');
});

test('never deletes an edit made by any of the four exempt roles', async () => {
  for (const roleId of NO_EDIT_EXEMPT_ROLE_IDS) {
    const s = scenario({ roles: [roleId] });
    assert.equal(await enforceNoEditOnUpdate(s.oldMessage, s.newMessage), false);
    assert.equal(s.deleted(), 0);
  }
});

test('does not delete non-link edits, unchanged updates, or edits when disabled', async () => {
  for (const config of [
    { after: 'hello again' },
    { before: 'https://example.com', after: 'https://example.com' },
    { enabled: false },
  ]) {
    const s = scenario(config);
    assert.equal(await enforceNoEditOnUpdate(s.oldMessage, s.newMessage), false);
    assert.equal(s.deleted(), 0);
  }
});

test('skips deletion if member roles cannot be verified', async () => {
  const s = scenario();
  s.newMessage.member = null;
  s.newMessage.guild.members.fetch = async () => { throw new Error('Forbidden'); };
  assert.equal(await enforceNoEditOnUpdate(s.oldMessage, s.newMessage), false);
  assert.equal(s.deleted(), 0);
});
