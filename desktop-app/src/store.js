/**
 * Local storage for the desktop app: auth token and generated-alias history.
 *
 * DuckDuckGo does not expose a server-side list of previously generated
 * aliases, so we keep a small local history file purely for the user's own
 * convenience (e.g. to remember which alias was handed to which site).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

// `electron` is only importable when running inside the Electron runtime.
// Fall back gracefully so this module can also be unit-tested under plain Node.
let app;
try {
  ({ app } = require('electron'));
} catch (err) {
  app = null;
}

function configDir() {
  if (process.env.DUCKMAIL_CONFIG_DIR) {
    return process.env.DUCKMAIL_CONFIG_DIR;
  }
  const base = app ? app.getPath('userData') : os.tmpdir();
  return path.join(base, 'duckmail');
}

function credentialsPath() {
  return path.join(configDir(), 'credentials.json');
}

function historyPath() {
  return path.join(configDir(), 'history.json');
}

function writePrivateFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.chmodSync(tmpPath, 0o600);
  fs.renameSync(tmpPath, filePath);
}

function saveCredentials({ duckUsername, token, mainAddress }) {
  writePrivateFile(credentialsPath(), { duckUsername, token, mainAddress: mainAddress || null });
}

function loadCredentials() {
  const p = credentialsPath();
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function clearCredentials() {
  const p = credentialsPath();
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    return true;
  }
  return false;
}

function appendHistory(address, note) {
  const p = historyPath();
  let entries = [];
  if (fs.existsSync(p)) {
    entries = JSON.parse(fs.readFileSync(p, 'utf8')).entries || [];
  }
  entries.push({ address, note: note || null, createdAt: new Date().toISOString() });
  writePrivateFile(p, { entries });
  return entries;
}

function loadHistory() {
  const p = historyPath();
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8')).entries || [];
}

module.exports = {
  saveCredentials,
  loadCredentials,
  clearCredentials,
  appendHistory,
  loadHistory,
};
