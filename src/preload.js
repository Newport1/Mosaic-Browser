'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mosaic', {
  action: (action, payload) => ipcRenderer.invoke('tiles:action', action, payload),
  onState: callback => ipcRenderer.on('tiles:state', (_event, state) => callback(state)),
  onAddressFocus: callback => ipcRenderer.on('address:focus', callback)
});
