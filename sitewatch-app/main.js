const { app, BrowserWindow, ipcMain, Notification, shell, powerSaveBlocker } = require('electron');
const path = require('path');
const crypto = require('crypto');

const store = require('./src/store');
const analyze = require('./src/analyze');
const checker = require('./src/checker');
const notify = require('./src/notify');

const MIN_INTERVAL_SEC = 30; // be polite to the site
const MAX_LOG = 200;

let mainWindow;
let data;
const timers = new Map(); // watch id -> timeout handle
const runtime = new Map(); // watch id -> { status, detail, lastCheck, nextCheck, snapshot }
const log = [];

const dir = () => app.getPath('userData');
const persist = () => store.save(dir(), data);

function pushUpdate() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('state:update', snapshotState());
  }
}

function snapshotState() {
  return {
    watches: data.watches,
    settings: data.settings,
    runtime: Object.fromEntries(
      [...runtime].map(([id, r]) => [id, { status: r.status, detail: r.detail, lastCheck: r.lastCheck, nextCheck: r.nextCheck }])
    ),
    log,
  };
}

function addLog(msg) {
  log.unshift({ at: new Date().toISOString(), msg });
  if (log.length > MAX_LOG) log.length = MAX_LOG;
}

function rt(id) {
  if (!runtime.has(id)) runtime.set(id, { status: 'idle', detail: '', lastCheck: null, nextCheck: null, snapshot: null });
  return runtime.get(id);
}

async function alert(watch, title, body) {
  addLog(`ALERT — ${watch.name}: ${title}`);
  if (Notification.isSupported()) {
    const n = new Notification({ title: `${watch.name}: ${title}`, body, urgency: 'critical' });
    n.on('click', () => shell.openExternal(watch.url));
    n.show();
  }
  await notify.push(data.settings, `${watch.name}: ${title}`, body, watch.url);
}

async function runCheck(id) {
  const watch = data.watches.find((w) => w.id === id);
  if (!watch) return;
  const r = rt(id);
  r.status = 'checking';
  pushUpdate();
  try {
    const { text, finalUrl } = await checker.fetchPage(watch.url, watch.selector);
    r.lastCheck = new Date().toISOString();
    if (analyze.looksLoggedOut(watch.url, finalUrl)) {
      r.status = 'logged_out';
      r.detail = 'Redirected to a login page';
      if (!r.warnedLogout) {
        r.warnedLogout = true;
        await alert(watch, 'Login expired', 'Open SiteWatch and click “Log in” again.');
      }
      return;
    }
    r.warnedLogout = false;
    const norm = analyze.normalise(text);
    const { status, detail } = analyze.evaluate(norm, watch, r.snapshot);
    if (watch.mode === 'change') r.snapshot = norm;
    r.status = status;
    r.detail = detail;
    addLog(`${watch.name}: ${status}${detail ? ' — ' + detail.split('\n')[0] : ''}`);
    if (analyze.shouldAlert(status, r.alertedStatus)) {
      await alert(watch, status === 'in_stock' ? 'IN STOCK' : 'Page changed', detail || watch.url);
    }
    r.alertedStatus = status;
  } catch (err) {
    r.status = 'error';
    r.detail = err.message || String(err);
    r.lastCheck = new Date().toISOString();
    addLog(`${watch.name}: error — ${r.detail}`);
  } finally {
    pushUpdate();
  }
}

function clearTimer(id) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  rt(id).nextCheck = null;
}

function schedule(watch) {
  clearTimer(watch.id);
  if (!watch.enabled) return;
  const r = rt(watch.id);
  let delayMs;
  if (watch.schedule === 'times') {
    const next = analyze.nextAt(watch.times);
    if (!next) return;
    delayMs = next - Date.now();
  } else {
    const sec = Math.max(MIN_INTERVAL_SEC, Number(watch.everySec) || 60);
    delayMs = (sec + Math.random() * 10) * 1000;
  }
  r.nextCheck = new Date(Date.now() + delayMs).toISOString();
  timers.set(watch.id, setTimeout(async () => {
    if (watch.schedule === 'times' || analyze.inWindow(watch.window)) await runCheck(watch.id);
    const fresh = data.watches.find((w) => w.id === watch.id);
    if (fresh) schedule(fresh);
  }, delayMs));
}

function sanitise(w) {
  return {
    id: w.id || crypto.randomUUID(),
    name: String(w.name || '').trim() || 'Untitled',
    url: String(w.url || '').trim(),
    selector: String(w.selector || '').trim(),
    mode: ['in_stock', 'out_of_stock', 'change'].includes(w.mode) ? w.mode : 'change',
    keywords: String(w.keywords || '').trim(),
    schedule: w.schedule === 'times' ? 'times' : 'interval',
    everySec: Math.max(MIN_INTERVAL_SEC, Math.floor(Number(w.everySec) || 60)),
    times: String(w.times || '').trim(),
    window: String(w.window || '').trim(),
    enabled: !!w.enabled,
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980, height: 720, minWidth: 760, minHeight: 540, title: 'SiteWatch',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  data = store.load(dir());
  powerSaveBlocker.start('prevent-app-suspension'); // keep checking while the screen is off
  createWindow();
  data.watches.forEach(schedule);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.handle('state:get', () => snapshotState());

ipcMain.handle('watch:save', (_e, w) => {
  const clean = sanitise(w);
  if (!/^https?:\/\//i.test(clean.url)) return { ok: false, error: 'URL must start with http:// or https://' };
  if (clean.mode !== 'change' && !analyze.splitKeywords(clean.keywords).length) {
    return { ok: false, error: 'Enter at least one keyword for this mode.' };
  }
  if (clean.schedule === 'times' && !analyze.nextAt(clean.times)) {
    return { ok: false, error: 'Enter times like 09:00, 12:30' };
  }
  const i = data.watches.findIndex((x) => x.id === clean.id);
  if (i >= 0) { data.watches[i] = clean; rt(clean.id).snapshot = null; } else data.watches.push(clean);
  persist();
  schedule(clean);
  pushUpdate();
  return { ok: true, id: clean.id };
});

ipcMain.handle('watch:delete', (_e, id) => {
  clearTimer(id);
  runtime.delete(id);
  data.watches = data.watches.filter((w) => w.id !== id);
  persist();
  pushUpdate();
  return { ok: true };
});

ipcMain.handle('watch:checkNow', async (_e, id) => { await runCheck(id); return { ok: true }; });

ipcMain.handle('watch:login', async (_e, id) => {
  const w = data.watches.find((x) => x.id === id);
  if (!w) return { ok: false, error: 'Save the watch first.' };
  await checker.openLoginWindow(w.url);
  rt(id).warnedLogout = false;
  return { ok: true };
});

ipcMain.handle('settings:save', (_e, s) => {
  const hook = String(s.discordWebhook || '').trim();
  if (hook && !/^https:\/\//i.test(hook)) return { ok: false, error: 'Webhook must be an https:// URL.' };
  data.settings = { ntfyTopic: String(s.ntfyTopic || '').trim(), discordWebhook: hook };
  persist();
  return { ok: true };
});

ipcMain.handle('settings:test', async () => {
  await alert({ name: 'SiteWatch', url: 'https://example.com' }, 'Test alert', 'If you see this, alerts work.');
  pushUpdate();
  return { ok: true };
});

ipcMain.handle('open:url', (_e, url) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  return { ok: true };
});
