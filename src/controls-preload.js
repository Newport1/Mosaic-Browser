'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('controlsApi', {
  action(action) {
    if (action !== 'new' && action !== 'restore') return;
    ipcRenderer.send('controls:action', action);
  },
  onState(callback) {
    ipcRenderer.on('controls:state', (_event, state) => callback(state));
  },
});
