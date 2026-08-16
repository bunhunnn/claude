const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('duckmail', {
  requestCode: (duckUsername) => ipcRenderer.invoke('auth:requestCode', duckUsername),
  verifyCode: (duckUsername, rawCode) => ipcRenderer.invoke('auth:verifyCode', { duckUsername, rawCode }),
  whoami: () => ipcRenderer.invoke('auth:whoami'),
  logout: () => ipcRenderer.invoke('auth:logout'),

  generateOne: (note) => ipcRenderer.invoke('alias:generateOne', note),
  generateBatch: (count, note) => ipcRenderer.invoke('alias:generateBatch', { count, note }),
  cancelBatch: () => ipcRenderer.invoke('alias:cancelBatch'),
  onBatchProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('alias:batchProgress', listener);
    return () => ipcRenderer.removeListener('alias:batchProgress', listener);
  },

  history: () => ipcRenderer.invoke('history:list'),
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
});
