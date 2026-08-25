'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tileApi', {
  action(action, value) {
    const allowed = new Set([
      'activate',
      'back',
      'close',
      'focus',
      'forward',
      'navigate',
      'reload',
    ]);

    if (!allowed.has(action)) return;
    ipcRenderer.send('tile:action', { action, value });
  },
  onFocusAddress(callback) {
    ipcRenderer.on('tile:focus-address', () => callback());
  },
  onState(callback) {
    ipcRenderer.on('tile:state', (_event, state) => callback(state));
  },
});
