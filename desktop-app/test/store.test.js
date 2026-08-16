const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshStore(tmpDir) {
  process.env.DUCKMAIL_CONFIG_DIR = tmpDir;
  delete require.cache[require.resolve('../src/store')];
  return require('../src/store');
}

test('save and load credentials round-trip, file is 0600', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'duckmail-test-'));
  const store = freshStore(tmpDir);

  store.saveCredentials({ duckUsername: 'alice', token: 'tok', mainAddress: 'alice' });
  const loaded = store.loadCredentials();

  assert.deepEqual(loaded, { duckUsername: 'alice', token: 'tok', mainAddress: 'alice' });

  const filePath = path.join(tmpDir, 'credentials.json');
  const mode = fs.statSync(filePath).mode & 0o777;
  assert.equal(mode, 0o600);
});

test('load credentials returns null when missing', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'duckmail-test-'));
  const store = freshStore(tmpDir);
  assert.equal(store.loadCredentials(), null);
});

test('clear credentials removes the file and reports whether it existed', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'duckmail-test-'));
  const store = freshStore(tmpDir);
  store.saveCredentials({ duckUsername: 'alice', token: 'tok' });

  assert.equal(store.clearCredentials(), true);
  assert.equal(store.loadCredentials(), null);
  assert.equal(store.clearCredentials(), false);
});

test('history append and load accumulates entries in order', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'duckmail-test-'));
  const store = freshStore(tmpDir);

  assert.deepEqual(store.loadHistory(), []);

  store.appendHistory('abc123@duck.com', 'example.com');
  store.appendHistory('def456@duck.com');

  const entries = store.loadHistory();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].address, 'abc123@duck.com');
  assert.equal(entries[0].note, 'example.com');
  assert.equal(entries[1].note, null);
});
