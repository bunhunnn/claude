const { BrowserWindow } = require('electron');

const PARTITION = 'persist:sitewatch'; // shared, persistent cookie jar = your login

// Load a URL in a hidden window that shares the saved login, return its text.
async function fetchPage(url, selector, { settleMs = 2500, timeoutMs = 45000 } = {}) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  try {
    await Promise.race([
      win.loadURL(url),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Page load timed out')), timeoutMs)),
    ]);
    await new Promise((r) => setTimeout(r, settleMs)); // let JS-rendered content appear
    const sel = JSON.stringify(selector || 'body');
    const text = await win.webContents.executeJavaScript(
      `(() => { const el = document.querySelector(${sel}); return el ? el.innerText : null; })()`
    );
    if (text == null) throw new Error(`Selector not found: ${selector}`);
    return { text, finalUrl: win.webContents.getURL() };
  } finally {
    win.destroy();
  }
}

// Visible window for logging in by hand. Resolves when the user closes it.
function openLoginWindow(url) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 1000, height: 780, title: 'Log in, then close this window',
      webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true },
    });
    win.setMenuBarVisibility(false);
    win.loadURL(url);
    win.on('closed', resolve);
  });
}

module.exports = { fetchPage, openLoginWindow, PARTITION };
