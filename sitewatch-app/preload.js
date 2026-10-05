const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sitewatch', {
  state: () => ipcRenderer.invoke('state:get'),
  saveWatch: (watch) => ipcRenderer.invoke('watch:save', watch),
  deleteWatch: (id) => ipcRenderer.invoke('watch:delete', id),
  checkNow: (id) => ipcRenderer.invoke('watch:checkNow', id),
  login: (id) => ipcRenderer.invoke('watch:login', id),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
  testAlert: () => ipcRenderer.invoke('settings:test'),
  openUrl: (url) => ipcRenderer.invoke('open:url', url),
  onUpdate: (cb) => {
    const l = (_e, payload) => cb(payload);
    ipcRenderer.on('state:update', l);
    return () => ipcRenderer.removeListener('state:update', l);
  },
});
