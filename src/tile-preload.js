'use strict';

const { ipcRenderer } = require('electron');

let isGridThumbnail = false;

ipcRenderer.on('tile:mode', (_event, nextIsGridThumbnail) => {
  isGridThumbnail = nextIsGridThumbnail;
});

// A grid tile is a launcher for focus mode, not a tiny accidental click target.
window.addEventListener('pointerdown', event => {
  if (!isGridThumbnail) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  ipcRenderer.send('tile:activate');
}, true);
