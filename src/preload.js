'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mosaic', {
  platform: process.platform,
  action: (action, payload) => ipcRenderer.invoke('tiles:action', action, payload),
  onState: callback => ipcRenderer.on('tiles:state', (_event, state) => callback(state)),
  onAddressFocus: callback => ipcRenderer.on('address:focus', callback)
});
