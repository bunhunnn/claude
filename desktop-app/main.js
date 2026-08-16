const { app, BrowserWindow, ipcMain, clipboard, shell } = require('electron');
const path = require('path');

const api = require('./src/api');
const store = require('./src/store');

const MAX_BATCH_SIZE = 25;
const BATCH_DELAY_MS = 1500;

let mainWindow;
let batchCancelled = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 620,
    minWidth: 620,
    minHeight: 480,
    title: 'DuckMail',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Any link a user clicks inside the app opens in their real browser,
  // not inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

function errorMessage(err) {
  return err && err.message ? err.message : String(err);
}

ipcMain.handle('auth:requestCode', async (_event, duckUsername) => {
  try {
    await api.requestLoginCode(duckUsername);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
});

ipcMain.handle('auth:verifyCode', async (_event, { duckUsername, rawCode }) => {
  try {
    const otp = api.extractOtp(rawCode);
    const { token, mainAddress } = await api.verifyLoginCode(duckUsername, otp);
    store.saveCredentials({
      duckUsername: duckUsername.trim().replace(/@duck\.com$/i, ''),
      token,
      mainAddress,
    });
    return { ok: true, mainAddress };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
});

ipcMain.handle('auth:whoami', async () => {
  const creds = store.loadCredentials();
  if (!creds) return { loggedIn: false };
  return { loggedIn: true, duckUsername: creds.duckUsername, mainAddress: creds.mainAddress };
});

ipcMain.handle('auth:logout', async () => {
  return { cleared: store.clearCredentials() };
});

ipcMain.handle('alias:generateOne', async (_event, note) => {
  const creds = store.loadCredentials();
  if (!creds) return { ok: false, error: 'Not logged in.' };
  try {
    const address = await api.generateAlias(creds.token);
    const full = `${address}@duck.com`;
    store.appendHistory(full, note);
    return { ok: true, address: full };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
});

ipcMain.handle('alias:generateBatch', async (event, { count, note }) => {
  const creds = store.loadCredentials();
  if (!creds) return { ok: false, error: 'Not logged in.' };

  const safeCount = Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(Number(count) || 0)));
  batchCancelled = false;
  const results = [];

  for (let i = 0; i < safeCount; i++) {
    if (batchCancelled) {
      event.sender.send('alias:batchProgress', { done: i, total: safeCount, cancelled: true });
      return { ok: true, results, cancelled: true };
    }
    try {
      const address = await api.generateAlias(creds.token);
      const full = `${address}@duck.com`;
      store.appendHistory(full, note);
      results.push({ address: full, error: null });
    } catch (err) {
      results.push({ address: null, error: errorMessage(err) });
      // Stop early on auth failures; keep going on transient errors.
      if (err instanceof api.AuthenticationError) {
        event.sender.send('alias:batchProgress', { done: i + 1, total: safeCount, cancelled: false });
        return { ok: false, error: errorMessage(err), results };
      }
    }
    event.sender.send('alias:batchProgress', { done: i + 1, total: safeCount, cancelled: false });
    if (i < safeCount - 1) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return { ok: true, results, cancelled: false };
});

ipcMain.handle('alias:cancelBatch', async () => {
  batchCancelled = true;
  return { ok: true };
});

ipcMain.handle('history:list', async () => {
  return store.loadHistory();
});

ipcMain.handle('clipboard:write', async (_event, text) => {
  clipboard.writeText(text);
  return { ok: true };
});
