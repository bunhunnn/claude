const $ = (id) => document.getElementById(id);
let state = { watches: [], settings: {}, runtime: {}, log: [] };
let editingId = null;

const STATUS_LABEL = {
  idle: 'Waiting', checking: 'Checking…', in_stock: 'IN STOCK', out_of_stock: 'Not in stock',
  changed: 'Changed', unchanged: 'No change', error: 'Error', logged_out: 'Login expired',
};

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  kids.forEach((k) => e.append(k));
  return e;
}
const fmt = (iso) => (iso ? new Date(iso).toLocaleTimeString() : '—');

function renderList() {
  const list = $('list');
  list.replaceChildren();
  if (!state.watches.length) {
    list.append(el('div', { className: 'empty', textContent: 'No watches yet. Click “+ New watch”.' }));
    return;
  }
  for (const w of state.watches) {
    const r = state.runtime[w.id] || { status: 'idle' };
    const status = w.enabled ? r.status : 'idle';
    const card = el('div', { className: 'watch' });
    const top = el('div', { className: 'top' },
      el('span', { className: 'name', textContent: w.name }),
      el('span', { className: `badge ${status}`, textContent: w.enabled ? STATUS_LABEL[status] || status : 'Paused' }));
    const sched = w.schedule === 'times' ? `at ${w.times}` : `every ${w.everySec}s${w.window ? ` (${w.window})` : ''}`;
    const meta = el('div', { className: 'meta', textContent: `${w.url} · ${sched} · last ${fmt(r.lastCheck)} · next ${fmt(r.nextCheck)}` });
    const detail = r.detail ? el('div', { className: 'meta', textContent: r.detail }) : '';
    const actions = el('div', { className: 'row' });
    const btn = (label, fn, cls = 'secondary') => {
      const b = el('button', { className: `small ${cls}`, textContent: label });
      b.onclick = fn; actions.append(b);
    };
    btn('Log in', () => window.sitewatch.login(w.id), '');
    btn('Check now', () => window.sitewatch.checkNow(w.id));
    btn('Open page', () => window.sitewatch.openUrl(w.url));
    btn('Edit', () => openEditor(w));
    btn(w.enabled ? 'Pause' : 'Resume', () => window.sitewatch.saveWatch({ ...w, enabled: !w.enabled }));
    btn('Delete', () => { if (confirm(`Delete “${w.name}”?`)) window.sitewatch.deleteWatch(w.id); });
    card.append(top, meta, detail, actions);
    list.append(card);
  }
}

function renderLog() {
  $('log').replaceChildren(...state.log.map((l) => el('div', { textContent: `${new Date(l.at).toLocaleTimeString()}  ${l.msg}` })));
}

function render() { renderList(); renderLog(); }

function syncEditor() {
  $('kw-row').classList.toggle('hidden', $('f-mode').value === 'change');
  const times = $('f-schedule').value === 'times';
  $('row-times').classList.toggle('hidden', !times);
  $('row-interval').classList.toggle('hidden', times);
  $('row-window').classList.toggle('hidden', times);
}

function openEditor(w) {
  editingId = w ? w.id : null;
  $('editor-title').textContent = w ? 'Edit watch' : 'New watch';
  const d = w || { name: '', url: '', selector: '', mode: 'out_of_stock', keywords: 'Sold out', schedule: 'interval', everySec: 60, times: '', window: '', enabled: true };
  $('f-name').value = d.name; $('f-url').value = d.url; $('f-selector').value = d.selector;
  $('f-mode').value = d.mode; $('f-keywords').value = d.keywords; $('f-schedule').value = d.schedule;
  $('f-every').value = d.everySec; $('f-times').value = d.times; $('f-window').value = d.window;
  $('f-enabled').checked = d.enabled;
  $('editor-error').classList.add('hidden');
  syncEditor();
  $('settings').classList.add('hidden');
  $('editor').classList.remove('hidden');
}

$('btn-new').onclick = () => openEditor(null);
$('btn-cancel').onclick = () => $('editor').classList.add('hidden');
$('f-mode').onchange = syncEditor;
$('f-schedule').onchange = syncEditor;

$('btn-save').onclick = async () => {
  const res = await window.sitewatch.saveWatch({
    id: editingId, name: $('f-name').value, url: $('f-url').value, selector: $('f-selector').value,
    mode: $('f-mode').value, keywords: $('f-keywords').value, schedule: $('f-schedule').value,
    everySec: $('f-every').value, times: $('f-times').value, window: $('f-window').value,
    enabled: $('f-enabled').checked,
  });
  if (!res.ok) { $('editor-error').textContent = res.error; $('editor-error').classList.remove('hidden'); return; }
  $('editor').classList.add('hidden');
};

$('btn-settings').onclick = () => {
  $('s-ntfy').value = state.settings.ntfyTopic || '';
  $('s-discord').value = state.settings.discordWebhook || '';
  $('editor').classList.add('hidden');
  $('settings').classList.remove('hidden');
};
$('btn-settings-close').onclick = () => $('settings').classList.add('hidden');
async function saveSettings() {
  const res = await window.sitewatch.saveSettings({ ntfyTopic: $('s-ntfy').value, discordWebhook: $('s-discord').value });
  const msg = $('settings-msg');
  msg.textContent = res.ok ? 'Saved.' : res.error;
  msg.classList.remove('hidden');
  return res.ok;
}
$('btn-settings-save').onclick = saveSettings;
$('btn-settings-test').onclick = async () => { if (await saveSettings()) window.sitewatch.testAlert(); };

window.sitewatch.onUpdate((s) => { state = s; render(); });
window.sitewatch.state().then((s) => { state = s; render(); });
setInterval(render, 15000); // refresh "last/next" times
