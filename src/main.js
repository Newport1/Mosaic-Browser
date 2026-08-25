'use strict';

const { app, BrowserWindow, WebContentsView, ipcMain, shell } = require('electron');
const path = require('node:path');
const { calculateTiles } = require('./layout');

const MAX_TILES = 4;
let window;
let tiles = [];
let activeTile = 0;

function normalizeUrl(value) {
  const input = value.trim();
  if (!input) return 'https://www.google.com';
  if (/^https?:\/\//i.test(input)) return input;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(input)) return `https://${input}`;
  return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
}

function tileState(tile, index) {
  const wc = tile.webContents;
  return { index, title: wc.getTitle() || 'New tab', url: wc.getURL(), loading: wc.isLoading() };
}

function broadcast() {
  if (!window || window.isDestroyed()) return;
  window.webContents.send('tiles:state', { activeTile, tiles: tiles.map(tileState) });
}

function layoutTiles() {
  if (!window) return;
  const bounds = window.getContentBounds();
  calculateTiles(bounds, tiles.length).forEach((bounds, index) => tiles[index].setBounds(bounds));
}

function addTile(url = 'https://www.google.com') {
  if (tiles.length >= MAX_TILES) return;
  const tile = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  tiles.push(tile);
  activeTile = tiles.length - 1;
  window.contentView.addChildView(tile);
  tile.setBackgroundColor('#f4f4ef');
  tile.webContents.setWindowOpenHandler(({ url }) => { tile.webContents.loadURL(url); return { action: 'deny' }; });
  for (const event of ['did-start-loading', 'did-stop-loading', 'page-title-updated', 'did-navigate', 'did-navigate-in-page']) {
    tile.webContents.on(event, broadcast);
  }
  tile.webContents.on('focus', () => {
    activeTile = tiles.indexOf(tile);
    broadcast();
  });
  tile.webContents.on('will-navigate', (event, destination) => {
    if (!/^https?:/i.test(destination)) { event.preventDefault(); shell.openExternal(destination); }
  });
  tile.webContents.loadURL(normalizeUrl(url));
  layoutTiles();
  broadcast();
}

function removeTile(index) {
  if (tiles.length === 1) return;
  const [tile] = tiles.splice(index, 1);
  window.contentView.removeChildView(tile);
  tile.webContents.close();
  activeTile = Math.min(activeTile, tiles.length - 1);
  layoutTiles();
  broadcast();
}

function createWindow() {
  window = new BrowserWindow({
    width: 1440, height: 920, minWidth: 760, minHeight: 560,
    title: 'Mosaic', backgroundColor: '#161814', titleBarStyle: 'hiddenInset',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  });
  window.loadFile(path.join(__dirname, 'index.html'));
  window.on('resize', layoutTiles);
  window.webContents.on('did-finish-load', () => addTile());
}

ipcMain.handle('tiles:action', (_event, action, payload) => {
  if (action === 'add') addTile(payload);
  if (action === 'close') removeTile(payload);
  if (action === 'activate' && tiles[payload]) { activeTile = payload; tiles[payload].webContents.focus(); }
  const tile = tiles[activeTile];
  if (!tile) return;
  if (action === 'navigate') tile.webContents.loadURL(normalizeUrl(payload));
  if (action === 'back' && tile.webContents.navigationHistory.canGoBack()) tile.webContents.navigationHistory.goBack();
  if (action === 'forward' && tile.webContents.navigationHistory.canGoForward()) tile.webContents.navigationHistory.goForward();
  if (action === 'reload') tile.webContents.reload();
  broadcast();
});

app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
