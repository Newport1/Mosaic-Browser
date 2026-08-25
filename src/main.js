'use strict';

const { app, BrowserWindow, WebContentsView, dialog, ipcMain, nativeTheme, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { CONFIRM_CLOSE_RESPONSE, createClosePrompt } = require('./close-prompt');
const { calculateTiles, calculateViewBounds, workspaceBounds, HIDDEN_BOUNDS } = require('./layout');
const {
  isAllowedExternalUrl,
  isBrowsableUrl,
  isUserNavigableUrl,
  normalizeInput
} = require('./navigation');

const CONTROL_VIEW_SIZE = 50;
const ANIMATION_DURATION = 210;
const NEW_PAGE_URL = pathToFileURL(path.join(__dirname, 'new-page.html')).toString();

let browserWindow;
let controlsView;
let tiles = [];
let activeTile = 0;
let focusedTile = null;
let reducedMotion = false;
let transitioning = false;
let animationToken = 0;

function browserBackground() {
  return nativeTheme.shouldUseDarkColors ? '#111111' : '#e7e7e7';
}

function updateThemeBackgrounds() {
  const color = browserBackground();
  browserWindow?.setBackgroundColor(color);
  tiles.forEach(tile => tile.setBackgroundColor(color));
}

function navigationState(webContents) {
  try {
    return {
      canGoBack: webContents.navigationHistory.canGoBack(),
      canGoForward: webContents.navigationHistory.canGoForward()
    };
  } catch {
    return { canGoBack: false, canGoForward: false };
  }
}

function tileState(tile, index) {
  const webContents = tile.webContents;
  const url = webContents.getURL();
  return {
    index,
    title: url === NEW_PAGE_URL ? 'New tab' : webContents.getTitle() || 'Untitled page',
    url: url === NEW_PAGE_URL ? '' : url,
    loading: webContents.isLoading(),
    ...navigationState(webContents)
  };
}

function currentState() {
  return {
    activeTile,
    focusedTile,
    transitioning,
    isWindowFullscreen: Boolean(browserWindow?.isFullScreen()),
    tiles: tiles.map(tileState)
  };
}

function sendState(webContents, state) {
  if (webContents && !webContents.isDestroyed()) webContents.send('tiles:state', state);
}

function broadcast() {
  if (!browserWindow || browserWindow.isDestroyed()) return;
  const state = currentState();
  sendState(browserWindow.webContents, state);
  sendState(controlsView?.webContents, state);

  tiles.forEach((tile, index) => {
    const isThumbnail = tiles.length > 1 && focusedTile === null;
    sendState(tile.webContents, state);
    tile.webContents.send('tile:mode', isThumbnail && index !== focusedTile);
  });
}

function positionControls() {
  if (!browserWindow || !controlsView) return;

  if (focusedTile === null || transitioning) {
    controlsView.setBounds(HIDDEN_BOUNDS);
    return;
  }

  const bounds = browserWindow.getContentBounds();
  controlsView.setBounds({
    x: Math.max(0, bounds.width - CONTROL_VIEW_SIZE - 8),
    y: Math.max(0, bounds.height - CONTROL_VIEW_SIZE - 8),
    width: CONTROL_VIEW_SIZE,
    height: CONTROL_VIEW_SIZE
  });
}

function bringControlsToFront() {
  if (!browserWindow || !controlsView) return;
  browserWindow.contentView.removeChildView(controlsView);
  browserWindow.contentView.addChildView(controlsView);
  positionControls();
}

function bringTileToFront(tile) {
  if (!browserWindow || !tile) return;
  browserWindow.contentView.removeChildView(tile);
  browserWindow.contentView.addChildView(tile);
  bringControlsToFront();
}

function interpolateBounds(from, to, progress) {
  const value = key => Math.round(from[key] + (to[key] - from[key]) * progress);
  return { x: value('x'), y: value('y'), width: value('width'), height: value('height') };
}

function animateBounds(view, target, onComplete) {
  const token = ++animationToken;
  const from = view.getBounds();

  if (reducedMotion || ANIMATION_DURATION === 0) {
    view.setBounds(target);
    onComplete();
    return;
  }

  const startedAt = Date.now();
  const timer = setInterval(() => {
    if (token !== animationToken || view.webContents.isDestroyed()) {
      clearInterval(timer);
      return;
    }

    const linear = Math.min(1, (Date.now() - startedAt) / ANIMATION_DURATION);
    const eased = linear < 0.5
      ? 4 * linear * linear * linear
      : 1 - Math.pow(-2 * linear + 2, 3) / 2;
    view.setBounds(interpolateBounds(from, target, eased));

    if (linear === 1) {
      clearInterval(timer);
      view.setBounds(target);
      onComplete();
    }
  }, 16);
}

function settleLayout() {
  if (!browserWindow) return;
  animationToken += 1;
  transitioning = false;

  if (focusedTile !== null && !tiles[focusedTile]) focusedTile = null;
  const bounds = calculateViewBounds(browserWindow.getContentBounds(), tiles.length, focusedTile);
  bounds.forEach((tileBounds, index) => tiles[index].setBounds(tileBounds));
  if (focusedTile !== null) bringTileToFront(tiles[focusedTile]);
  else bringControlsToFront();
  positionControls();
  broadcast();
}

function focusTile(index) {
  if (!tiles[index] || tiles.length < 2 || focusedTile !== null || transitioning) return;
  activeTile = index;
  focusedTile = index;
  transitioning = true;

  const target = workspaceBounds(browserWindow.getContentBounds());
  tiles.forEach((tile, tileIndex) => {
    if (tileIndex !== index) tile.setBounds({ x: -10000, y: -10000, width: 1, height: 1 });
  });
  bringTileToFront(tiles[index]);
  positionControls();
  broadcast();

  animateBounds(tiles[index], target, () => {
    transitioning = false;
    bringControlsToFront();
    broadcast();
  });
}

function restoreGrid() {
  if (focusedTile === null || transitioning || !tiles[focusedTile]) return;
  const index = focusedTile;
  const grid = calculateTiles(browserWindow.getContentBounds(), tiles.length);
  transitioning = true;

  grid.forEach((tileBounds, tileIndex) => {
    if (tileIndex !== index) tiles[tileIndex].setBounds(tileBounds);
  });
  bringTileToFront(tiles[index]);
  broadcast();

  animateBounds(tiles[index], grid[index], () => {
    focusedTile = null;
    transitioning = false;
    bringControlsToFront();
    positionControls();
    broadcast();
  });
}

function openExternal(url) {
  if (isAllowedExternalUrl(url)) void shell.openExternal(url);
}

function loadUserInput(tile, value) {
  const target = normalizeInput(value);
  const destination = target || NEW_PAGE_URL;
  if (destination !== NEW_PAGE_URL && !isUserNavigableUrl(destination)) return;
  tile.allowedNavigation = destination;
  void tile.webContents.loadURL(destination);
}

function handleTileShortcut(tile, event, input) {
  if (input.type !== 'keyDown') return;
  const primary = input.control || input.meta;
  const key = input.key.toLowerCase();
  const index = tiles.indexOf(tile);

  if (primary && key === 't') {
    event.preventDefault();
    addTile();
  } else if (primary && key === 'w') {
    event.preventDefault();
    removeTile(index);
  } else if (primary && key === 'l') {
    event.preventDefault();
    activeTile = index;
    browserWindow.webContents.send('address:focus');
    broadcast();
  } else if ((input.key === 'Escape' || input.key === 'Esc') && focusedTile !== null) {
    event.preventDefault();
    restoreGrid();
  } else if (input.key === 'F11') {
    event.preventDefault();
    browserWindow.setFullScreen(!browserWindow.isFullScreen());
  }
}

function attachTileEvents(tile) {
  const webContents = tile.webContents;

  webContents.setWindowOpenHandler(({ url }) => {
    if (isBrowsableUrl(url)) addTile(url);
    else openExternal(url);
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, destination) => {
    if (destination === tile.allowedNavigation) {
      tile.allowedNavigation = null;
      return;
    }
    if (isBrowsableUrl(destination)) return;
    event.preventDefault();
    openExternal(destination);
  });

  webContents.on('before-input-event', (event, input) => handleTileShortcut(tile, event, input));

  for (const eventName of [
    'did-start-loading',
    'did-stop-loading',
    'page-title-updated',
    'did-navigate',
    'did-navigate-in-page'
  ]) {
    webContents.on(eventName, broadcast);
  }
}

function addTile(url) {
  if (!browserWindow) return;
  animationToken += 1;
  transitioning = false;
  focusedTile = null;

  const tile = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'tile-preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  tiles.push(tile);
  activeTile = tiles.length - 1;
  browserWindow.contentView.addChildView(tile);
  tile.setBackgroundColor(browserBackground());
  attachTileEvents(tile);
  loadUserInput(tile, typeof url === 'string' ? url : '');
  settleLayout();
}

function removeTile(index) {
  if (!Number.isInteger(index) || !tiles[index] || !browserWindow) return;

  if (tiles.length === 1) {
    browserWindow.close();
    return;
  }

  animationToken += 1;
  transitioning = false;

  const [tile] = tiles.splice(index, 1);
  browserWindow.contentView.removeChildView(tile);
  if (!tile.webContents.isDestroyed()) tile.webContents.close();

  if (focusedTile === index) focusedTile = null;
  else if (focusedTile !== null && focusedTile > index) focusedTile -= 1;
  activeTile = tiles.length === 0 ? 0 : Math.min(index, tiles.length - 1);
  settleLayout();
}

function activeWebContents() {
  return tiles[activeTile]?.webContents;
}

async function confirmCloseAll() {
  const owner = browserWindow;
  if (!owner || owner.isDestroyed() || tiles.length === 0) return false;

  const result = await dialog.showMessageBox(owner, createClosePrompt(tiles.length));
  if (result.response !== CONFIRM_CLOSE_RESPONSE || owner.isDestroyed()) return false;

  owner.close();
  return true;
}

function isTrustedActionSender(sender) {
  return sender === browserWindow?.webContents || sender === controlsView?.webContents;
}

function createControlsView() {
  controlsView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  controlsView.setBackgroundColor('#00000000');
  browserWindow.contentView.addChildView(controlsView);
  controlsView.webContents.on('did-finish-load', broadcast);
  void controlsView.webContents.loadFile(path.join(__dirname, 'controls.html'));
  positionControls();
}

function createWindow() {
  const windowed = process.argv.includes('--windowed');
  browserWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 420,
    minHeight: 300,
    show: false,
    fullscreen: !windowed,
    title: 'Mosaic',
    backgroundColor: browserBackground(),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  void browserWindow.loadFile(path.join(__dirname, 'index.html'));
  browserWindow.on('resize', settleLayout);
  browserWindow.on('enter-full-screen', broadcast);
  browserWindow.on('leave-full-screen', broadcast);
  browserWindow.once('ready-to-show', () => {
    if (windowed) browserWindow.maximize();
    browserWindow.show();
  });
  browserWindow.webContents.on('did-finish-load', () => {
    createControlsView();
    addTile();
  });
  browserWindow.on('closed', () => {
    animationToken += 1;
    for (const tile of tiles) {
      if (!tile.webContents.isDestroyed()) tile.webContents.close();
    }
    if (controlsView && !controlsView.webContents.isDestroyed()) controlsView.webContents.close();
    tiles = [];
    activeTile = 0;
    focusedTile = null;
    controlsView = undefined;
    browserWindow = undefined;
  });
}

ipcMain.on('tile:activate', event => {
  const index = tiles.findIndex(tile => tile.webContents.id === event.sender.id);
  focusTile(index);
});

ipcMain.handle('tiles:action', async (event, action, payload) => {
  if (!isTrustedActionSender(event.sender)) throw new Error('Untrusted browser action sender');

  const webContents = activeWebContents();

  if (action === 'add') addTile(typeof payload === 'string' ? payload : undefined);
  else if (action === 'close') removeTile(Number.isInteger(payload) ? payload : activeTile);
  else if (action === 'close-all') return { closed: await confirmCloseAll() };
  else if (action === 'restore') restoreGrid();
  else if (action === 'toggle-fullscreen' && browserWindow) browserWindow.setFullScreen(!browserWindow.isFullScreen());
  else if (action === 'set-reduced-motion') reducedMotion = Boolean(payload);
  else if (action === 'navigate' && tiles[activeTile]) loadUserInput(tiles[activeTile], String(payload ?? ''));
  else if (action === 'back' && webContents?.navigationHistory.canGoBack()) webContents.navigationHistory.goBack();
  else if (action === 'forward' && webContents?.navigationHistory.canGoForward()) webContents.navigationHistory.goForward();
  else if (action === 'reload' && webContents) webContents.reload();
  else if (action === 'stop' && webContents) webContents.stop();

  if (browserWindow && !browserWindow.isDestroyed()) {
    broadcast();
    return currentState();
  }

  return { closed: true };
});

app.whenReady().then(() => {
  nativeTheme.themeSource = 'system';
  nativeTheme.on('updated', updateThemeBackgrounds);
  createWindow();
  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
