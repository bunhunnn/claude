const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../src/store');

test('load returns defaults when no file, and round-trips saves', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-'));
  assert.deepStrictEqual(store.load(dir).watches, []);
  store.save(dir, { watches: [{ id: '1' }], settings: { ntfyTopic: 't' } });
  const d = store.load(dir);
  assert.strictEqual(d.watches[0].id, '1');
  assert.strictEqual(d.settings.ntfyTopic, 't');
  assert.strictEqual(d.settings.discordWebhook, '');
});

test('corrupt file falls back to defaults', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-'));
  fs.writeFileSync(path.join(dir, 'sitewatch.json'), '{nope');
  assert.deepStrictEqual(store.load(dir).watches, []);
});
