// Pure helpers: no Electron imports so they can be unit-tested with node --test.

function normalise(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

function splitKeywords(str) {
  return String(str || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// mode: 'in_stock' (alert when any keyword appears), 'out_of_stock'
// (alert when none of the keywords appear), 'change' (any text change).
function evaluate(text, watch, previousSnapshot) {
  const low = text.toLowerCase();
  const keywords = splitKeywords(watch.keywords);

  if (watch.mode === 'in_stock') {
    const hit = keywords.find((k) => low.includes(k.toLowerCase()));
    return hit
      ? { status: 'in_stock', detail: `found "${hit}"` }
      : { status: 'out_of_stock', detail: 'in-stock text not present' };
  }
  if (watch.mode === 'out_of_stock') {
    const hit = keywords.find((k) => low.includes(k.toLowerCase()));
    return hit
      ? { status: 'out_of_stock', detail: `found "${hit}"` }
      : { status: 'in_stock', detail: 'out-of-stock text is gone' };
  }
  if (previousSnapshot == null) return { status: 'unchanged', detail: 'first snapshot stored' };
  if (previousSnapshot === text) return { status: 'unchanged', detail: '' };
  return { status: 'changed', detail: simpleDiff(previousSnapshot, text) };
}

function simpleDiff(oldText, newText) {
  const a = new Set(oldText.split('\n'));
  const b = new Set(newText.split('\n'));
  const out = [];
  for (const l of newText.split('\n')) if (!a.has(l)) out.push(`+ ${l}`);
  for (const l of oldText.split('\n')) if (!b.has(l)) out.push(`- ${l}`);
  return out.slice(0, 15).join('\n');
}

// Should we send an alert for this transition?
function shouldAlert(status, previousStatus) {
  if (status === 'in_stock') return previousStatus !== 'in_stock';
  return status === 'changed';
}

function parseHHMM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// window like "08:00-22:00" (may wrap past midnight). Empty = always.
function inWindow(window, now = new Date()) {
  if (!window || !window.trim()) return true;
  const [a, b] = window.split('-').map(parseHHMM);
  if (a == null || b == null) return true;
  const n = minutesOfDay(now);
  return a <= b ? n >= a && n <= b : n >= a || n <= b;
}

// Next Date strictly after `now` matching one of the "HH:MM" times, or null.
function nextAt(times, now = new Date()) {
  const mins = splitKeywords(times).map(parseHHMM).filter((m) => m != null);
  if (mins.length === 0) return null;
  let best = null;
  for (const dayOffset of [0, 1]) {
    for (const m of mins) {
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (d > now && (!best || d < best)) best = d;
    }
  }
  return best;
}

const LOGIN_HINTS = ['/login', '/signin', '/sign-in', '/auth', 'oauth'];

// Did loading `requested` land us on a login page instead?
function looksLoggedOut(requested, finalUrl) {
  if (requested === finalUrl) return false;
  const f = finalUrl.toLowerCase();
  const r = requested.toLowerCase();
  return LOGIN_HINTS.some((h) => f.includes(h) && !r.includes(h));
}

module.exports = {
  normalise, splitKeywords, evaluate, shouldAlert,
  parseHHMM, inWindow, nextAt, looksLoggedOut, simpleDiff,
};
