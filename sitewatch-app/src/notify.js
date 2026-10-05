const https = require('https');
const { URL } = require('url');

function post(urlStr, body, headers) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      if (u.protocol !== 'https:') return resolve(false);
      const req = https.request(u, { method: 'POST', headers, timeout: 10000 }, (res) => {
        res.resume();
        resolve(res.statusCode < 300);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end(body);
    } catch {
      resolve(false);
    }
  });
}

async function push(settings, title, body, url) {
  const jobs = [];
  if (settings.ntfyTopic) {
    jobs.push(post(`https://ntfy.sh/${encodeURIComponent(settings.ntfyTopic)}`, body,
      { Title: title, Priority: 'urgent', Click: url }));
  }
  if (settings.discordWebhook) {
    jobs.push(post(settings.discordWebhook,
      JSON.stringify({ content: `**${title}**\n${body}\n${url}` }),
      { 'Content-Type': 'application/json' }));
  }
  await Promise.all(jobs);
}

module.exports = { push };
