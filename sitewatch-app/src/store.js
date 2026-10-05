const fs = require('fs');
const path = require('path');

const DEFAULTS = { watches: [], settings: { ntfyTopic: '', discordWebhook: '' } };

function filePath(dir) {
  return path.join(dir, 'sitewatch.json');
}

function load(dir) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath(dir), 'utf8'));
    return {
      watches: Array.isArray(raw.watches) ? raw.watches : [],
      settings: { ...DEFAULTS.settings, ...(raw.settings || {}) },
    };
  } catch {
    return { watches: [], settings: { ...DEFAULTS.settings } };
  }
}

function save(dir, data) {
  fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath(dir) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, filePath(dir));
}

module.exports = { load, save };
