'use strict';

const path = require('node:path');
const {
  app,
  BaseWindow,
  ipcMain,
  Menu,
  shell,
  WebContentsView,
} = require('electron');
const {
  computeTileBounds,
  contentBounds,
  normalizeInput,
} = require('./layout');
const { isAllowedExternalUrl, isBrowsableUrl } = require('./navigation');

const GAP = 3;
const CHROME_HEIGHT = 38;
const CONTROL_SIZE = 62;
const ANIMATION_MS = 360;
const UI_ROOT = __dirname;
const PRELOAD_ROOT = __dirname;

let browserWindow = null;
let controlsView = null;
let focusedTileId = null;
let activeTileId = null;
let tileSequence = 0;
let animationInProgress = false;
let tiles = [];

function windowSize() {
  if (!browserWindow) return { width: 0, height: 0 };
  const bounds = browserWindow.getContentBounds();
  return { width: bounds.width, height: bounds.height };
}

function tileById(id) {
  return tiles.find((tile) => tile.id === id) ?? null;
}

function tileForChromeSender(senderId) {
  return tiles.find((tile) => tile.chrome.webContents.id === senderId) ?? null;
}

function isAlive(view) {
  return view && !view.webContents.isDestroyed();
}

function safeSetBounds(view, bounds) {
  if (!isAlive(view)) return;

  const normalized = {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(0, Math.round(bounds.width)),
    height: Math.max(0, Math.round(bounds.height)),
  };

  view.setVisible(normalized.width > 0 && normalized.height > 0);
  view.setBounds(normalized);
}

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function animateViewBounds(entries, duration = ANIMATION_MS) {
  const animations = entries.map(({ view, target }) => ({
    view,
    start: view.getBounds(),
    target,
  }));
  const startedAt = Date.now();

  return new Promise((resolve) => {
    function frame() {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = easeInOutCubic(progress);

      animations.forEach(({ view, start, target }) => {
        safeSetBounds(view, {
          x: start.x + (target.x - start.x) * eased,
          y: start.y + (target.y - start.y) * eased,
          width: start.width + (target.width - start.width) * eased,
          height: start.height + (target.height - start.height) * eased,
        });
      });

      if (progress < 1) setTimeout(frame, 16);
      else resolve();
    }

    frame();
  });
}

function makeLocalView(preloadName) {
  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(PRELOAD_ROOT, preloadName),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: true,
    },
  });

  view.setBackgroundColor('#00000000');
  return view;
}

function makePageView() {
  const view = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      partition: 'persist:tile-browser',
      devTools: true,
    },
  });

  view.setBackgroundColor('#ffffff');
  return view;
}

function attachKeyboardShortcuts(webContents) {
  webContents.on('before-input-event', (event, input) => {
    const command = input.control || input.meta;
    const key = input.key.toLowerCase();

    if (input.type !== 'keyDown') return;

    if (command && key === 't') {
      event.preventDefault();
      void createTileFromShortcut();
      return;
    }

    if (command && key === 'l') {
      event.preventDefault();
      focusActiveAddress();
      return;
    }

    if (command && key === 'w') {
      event.preventDefault();
      const tile = tileById(focusedTileId ?? activeTileId);
      if (tile) closeTile(tile.id);
      return;
    }

    if (command && key === 'r') {
      event.preventDefault();
      const tile = tileById(focusedTileId ?? activeTileId);
      if (tile && isAlive(tile.page)) tile.page.webContents.reload();
      return;
    }

    if (input.key === 'Escape' && focusedTileId !== null) {
      event.preventDefault();
      void restoreFocusedTile();
    }
  });
}

function addViewOnTop(view) {
  if (!browserWindow || !view) return;
  browserWindow.contentView.addChildView(view);
}

function keepControlsOnTop() {
  if (controlsView) addViewOnTop(controlsView);
}

function controlsBounds() {
  const { width, height } = windowSize();
  return {
    x: Math.max(0, width - CONTROL_SIZE - 12),
    y: Math.max(0, height - CONTROL_SIZE - 12),
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
  };
}

function sendControlsState() {
  if (!isAlive(controlsView)) return;
  controlsView.webContents.send('controls:state', {
    mode: focusedTileId === null ? 'overview' : 'focused',
  });
}

function sendTileState(tile) {
  if (!isAlive(tile.chrome)) return;

  const index = tiles.indexOf(tile);
  const currentUrl = isAlive(tile.page) ? tile.page.webContents.getURL() : '';
  const displayUrl = currentUrl.startsWith('file:') ? '' : currentUrl;

  tile.chrome.webContents.send('tile:state', {
    active: tile.id === activeTileId,
    canGoBack: isAlive(tile.page) && tile.page.webContents.navigationHistory.canGoBack(),
    canGoForward: isAlive(tile.page) && tile.page.webContents.navigationHistory.canGoForward(),
    focused: tile.id === focusedTileId,
    index: index + 1,
    loading: tile.loading,
    title: tile.title,
    total: tiles.length,
    url: displayUrl,
  });
}

function sendAllTileStates() {
  tiles.forEach(sendTileState);
  sendControlsState();
}

function setActiveTile(id) {
  activeTileId = id;
  sendAllTileStates();
}

function overviewRects() {
  const { width, height } = windowSize();
  return computeTileBounds(tiles.length, width, height, GAP);
}

function layoutOverview() {
  if (!browserWindow || focusedTileId !== null || animationInProgress) return;

  const rects = overviewRects();

  tiles.forEach((tile, index) => {
    const tileRect = rects[index];
    safeSetBounds(tile.page, contentBounds(tileRect, CHROME_HEIGHT));
    safeSetBounds(tile.chrome, tileRect);
    tile.page.setVisible(tileRect.width > 0 && tileRect.height > CHROME_HEIGHT);
    tile.chrome.setVisible(tileRect.width > 0 && tileRect.height > 0);
  });

  safeSetBounds(controlsView, controlsBounds());
  keepControlsOnTop();
  sendAllTileStates();
}

function layoutFocused() {
  if (!browserWindow || focusedTileId === null || animationInProgress) return;

  const tile = tileById(focusedTileId);
  if (!tile) return;

  const { width, height } = windowSize();
  const fullBounds = { x: 0, y: 0, width, height };

  safeSetBounds(tile.page, contentBounds(fullBounds, CHROME_HEIGHT));
  safeSetBounds(tile.chrome, {
    x: 0,
    y: 0,
    width,
    height: Math.min(CHROME_HEIGHT, height),
  });
  safeSetBounds(controlsView, controlsBounds());
  keepControlsOnTop();
}

function refreshLayout() {
  if (focusedTileId === null) layoutOverview();
  else layoutFocused();
}

function navigateTile(tile, input) {
  const url = normalizeInput(input);
  if (!url || !isAlive(tile.page)) return;
  void tile.page.webContents.loadURL(url).catch(() => {});
}

function attachPageEvents(tile) {
  const contents = tile.page.webContents;

  contents.setWindowOpenHandler(({ url }) => {
    if (isBrowsableUrl(url)) void createTileInOverview(url);
    else if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, destination) => {
    if (isBrowsableUrl(destination)) return;
    event.preventDefault();
    if (isAllowedExternalUrl(destination)) void shell.openExternal(destination);
  });

  contents.on('did-start-loading', () => {
    tile.loading = true;
    sendTileState(tile);
  });

  contents.on('did-stop-loading', () => {
    tile.loading = false;
    sendTileState(tile);
  });

  contents.on('did-navigate', () => sendTileState(tile));
  contents.on('did-navigate-in-page', () => sendTileState(tile));

  contents.on('page-title-updated', (_event, title) => {
    tile.title = title || 'New page';
    sendTileState(tile);
  });

  contents.on('focus', () => {
    if (focusedTileId === tile.id) setActiveTile(tile.id);
  });

  attachKeyboardShortcuts(contents);
}

function createTile(initialInput = null) {
  if (!browserWindow) return null;

  const tile = {
    id: ++tileSequence,
    page: makePageView(),
    chrome: makeLocalView('preload.js'),
    loading: false,
    title: 'New page',
  };

  tiles.push(tile);
  addViewOnTop(tile.page);
  addViewOnTop(tile.chrome);
  keepControlsOnTop();

  attachPageEvents(tile);
  attachKeyboardShortcuts(tile.chrome.webContents);

  tile.chrome.webContents.on('did-finish-load', () => {
    sendTileState(tile);
    tile.chrome.webContents.send('tile:focus-address');
  });

  void tile.chrome.webContents.loadFile(path.join(UI_ROOT, 'index.html'), {
    query: { id: String(tile.id) },
  });

  if (initialInput) navigateTile(tile, initialInput);
  else void tile.page.webContents.loadFile(path.join(UI_ROOT, 'start.html'));

  setActiveTile(tile.id);
  layoutOverview();
  return tile;
}

async function createTileFromShortcut() {
  await createTileInOverview();
}

async function createTileInOverview(initialInput = null) {
  if (animationInProgress) return;
  if (focusedTileId !== null) await restoreFocusedTile();
  createTile(initialInput);
}

async function focusTile(id) {
  if (focusedTileId !== null || animationInProgress) return;

  const tile = tileById(id);
  const index = tiles.indexOf(tile);
  if (!tile || index < 0) return;

  animationInProgress = true;
  setActiveTile(id);

  const sourceRect = overviewRects()[index];
  const { width, height } = windowSize();
  const fullRect = { x: 0, y: 0, width, height };

  focusedTileId = id;
  sendAllTileStates();

  addViewOnTop(tile.page);
  addViewOnTop(tile.chrome);
  keepControlsOnTop();

  safeSetBounds(tile.page, contentBounds(sourceRect, CHROME_HEIGHT));
  safeSetBounds(tile.chrome, sourceRect);
  await animateViewBounds([
    { view: tile.page, target: contentBounds(fullRect, CHROME_HEIGHT) },
    { view: tile.chrome, target: fullRect },
  ]);

  tiles.forEach((candidate) => {
    if (candidate.id === id) return;
    candidate.page.setVisible(false);
    candidate.chrome.setVisible(false);
  });

  safeSetBounds(tile.chrome, {
    x: 0,
    y: 0,
    width,
    height: Math.min(CHROME_HEIGHT, height),
  });
  safeSetBounds(controlsView, controlsBounds());
  keepControlsOnTop();
  animationInProgress = false;
  sendAllTileStates();
  tile.page.webContents.focus();
}

async function restoreFocusedTile() {
  if (focusedTileId === null || animationInProgress) return;

  const tile = tileById(focusedTileId);
  const index = tiles.indexOf(tile);
  if (!tile || index < 0) return;

  animationInProgress = true;
  const targetRect = overviewRects()[index];
  const { width, height } = windowSize();
  const fullRect = { x: 0, y: 0, width, height };

  tiles.forEach((candidate) => {
    candidate.page.setVisible(true);
    candidate.chrome.setVisible(true);
  });

  addViewOnTop(tile.page);
  addViewOnTop(tile.chrome);
  keepControlsOnTop();
  safeSetBounds(tile.chrome, fullRect);

  focusedTileId = null;
  sendAllTileStates();

  const rects = overviewRects();
  tiles.forEach((candidate, candidateIndex) => {
    if (candidate.id === tile.id) return;
    const rect = rects[candidateIndex];
    safeSetBounds(candidate.page, contentBounds(rect, CHROME_HEIGHT));
    safeSetBounds(candidate.chrome, rect);
  });

  await animateViewBounds([
    { view: tile.page, target: contentBounds(targetRect, CHROME_HEIGHT) },
    { view: tile.chrome, target: targetRect },
  ]);
  animationInProgress = false;
  layoutOverview();
  setActiveTile(tile.id);
}

function destroyTileViews(tile) {
  if (!browserWindow) return;

  for (const view of [tile.page, tile.chrome]) {
    browserWindow.contentView.removeChildView(view);
    if (isAlive(view)) view.webContents.close();
  }
}

function closeTile(id) {
  const tile = tileById(id);
  if (!tile || animationInProgress) return;

  const wasFocused = focusedTileId === id;
  tiles = tiles.filter((candidate) => candidate.id !== id);
  destroyTileViews(tile);

  if (wasFocused) focusedTileId = null;
  if (activeTileId === id) activeTileId = tiles.at(-1)?.id ?? null;

  if (tiles.length === 0) {
    createTile();
    return;
  }

  tiles.forEach((candidate) => {
    candidate.page.setVisible(true);
    candidate.chrome.setVisible(true);
  });

  layoutOverview();
  sendAllTileStates();
}

function focusActiveAddress() {
  const tile = tileById(focusedTileId ?? activeTileId);
  if (!isAlive(tile?.chrome)) return;
  tile.chrome.webContents.send('tile:focus-address');
  tile.chrome.webContents.focus();
}

function handleTileAction(event, payload) {
  const tile = tileForChromeSender(event.sender.id);
  if (!tile || !payload || typeof payload.action !== 'string') return;

  switch (payload.action) {
    case 'focus':
      void focusTile(tile.id);
      break;
    case 'navigate':
      navigateTile(tile, payload.value);
      break;
    case 'back':
      if (tile.page.webContents.navigationHistory.canGoBack()) {
        tile.page.webContents.navigationHistory.goBack();
      }
      break;
    case 'forward':
      if (tile.page.webContents.navigationHistory.canGoForward()) {
        tile.page.webContents.navigationHistory.goForward();
      }
      break;
    case 'reload':
      if (tile.loading) tile.page.webContents.stop();
      else tile.page.webContents.reload();
      break;
    case 'close':
      closeTile(tile.id);
      break;
    case 'activate':
      setActiveTile(tile.id);
      break;
    default:
      break;
  }
}

function handleControlsAction(event, action) {
  if (!isAlive(controlsView) || event.sender.id !== controlsView.webContents.id) return;

  if (action === 'new') void createTileFromShortcut();
  if (action === 'restore') void restoreFocusedTile();
}

function createControlsView() {
  controlsView = makeLocalView('controls-preload.js');
  attachKeyboardShortcuts(controlsView.webContents);
  addViewOnTop(controlsView);
  safeSetBounds(controlsView, controlsBounds());
  controlsView.webContents.on('did-finish-load', sendControlsState);
  void controlsView.webContents.loadFile(path.join(UI_ROOT, 'controls.html'));
}

function destroyAllViews() {
  tiles.forEach((tile) => {
    for (const view of [tile.page, tile.chrome]) {
      if (isAlive(view)) view.webContents.close();
    }
  });

  if (isAlive(controlsView)) controlsView.webContents.close();
  tiles = [];
  controlsView = null;
}

function createBrowserWindow() {
  const windowed = process.argv.includes('--windowed');

  browserWindow = new BaseWindow({
    width: 1440,
    height: 900,
    minWidth: 420,
    minHeight: 300,
    backgroundColor: '#080808',
    autoHideMenuBar: true,
    fullscreen: !windowed,
    show: true,
  });

  browserWindow.on('resize', refreshLayout);
  browserWindow.on('enter-full-screen', refreshLayout);
  browserWindow.on('leave-full-screen', refreshLayout);
  browserWindow.on('closed', () => {
    destroyAllViews();
    browserWindow = null;
  });

  createControlsView();
  createTile();
}

ipcMain.on('tile:action', handleTileAction);
ipcMain.on('controls:action', handleControlsAction);

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createBrowserWindow();

  app.on('activate', () => {
    if (!browserWindow) createBrowserWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
