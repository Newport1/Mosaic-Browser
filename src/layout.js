'use strict';

const DEFAULT_TOOLBAR_HEIGHT = 48;
const COMPACT_TOOLBAR_HEIGHT = 42;
const COMPACT_BREAKPOINT = 500;
const GAP = 6;
const TARGET_TILE_ASPECT = 16 / 10;
const HIDDEN_BOUNDS = Object.freeze({ x: -10000, y: -10000, width: 1, height: 1 });

function getToolbarHeight(width) {
  return width <= COMPACT_BREAKPOINT ? COMPACT_TOOLBAR_HEIGHT : DEFAULT_TOOLBAR_HEIGHT;
}

function workspaceBounds(bounds) {
  const toolbarHeight = getToolbarHeight(bounds.width);
  return {
    x: 0,
    y: toolbarHeight,
    width: Math.max(1, bounds.width),
    height: Math.max(1, bounds.height - toolbarHeight)
  };
}

// Select the grid that produces the largest useful page area while preferring
// browser-shaped tiles over extremely tall or wide slivers.
function chooseGrid(width, height, count) {
  let best = { columns: 1, rows: count, score: -Infinity };

  for (let columns = 1; columns <= count; columns += 1) {
    const rows = Math.ceil(count / columns);
    const tileWidth = Math.max(1, Math.floor((width - GAP * (columns - 1)) / columns));
    const tileHeight = Math.max(1, Math.floor((height - GAP * (rows - 1)) / rows));
    const aspect = tileWidth / tileHeight;
    const aspectFit = Math.sqrt(Math.min(aspect / TARGET_TILE_ASPECT, TARGET_TILE_ASPECT / aspect));
    const occupancy = count / (columns * rows);
    const score = tileWidth * tileHeight * aspectFit * (0.9 + occupancy * 0.1);

    if (score > best.score) best = { columns, rows, score };
  }

  return best;
}

function calculateTiles(bounds, count) {
  if (!Number.isInteger(count) || count <= 0) return [];

  const toolbarHeight = getToolbarHeight(bounds.width);
  const availableWidth = Math.max(1, bounds.width - GAP * 2);
  const availableHeight = Math.max(1, bounds.height - toolbarHeight - GAP * 2);
  const { columns, rows } = chooseGrid(availableWidth, availableHeight, count);
  const width = Math.max(1, Math.floor((availableWidth - GAP * (columns - 1)) / columns));
  const height = Math.max(1, Math.floor((availableHeight - GAP * (rows - 1)) / rows));

  return Array.from({ length: count }, (_, index) => ({
    x: GAP + (index % columns) * (width + GAP),
    y: toolbarHeight + GAP + Math.floor(index / columns) * (height + GAP),
    width,
    height
  }));
}

function calculateViewBounds(bounds, count, focusedIndex = null) {
  const grid = calculateTiles(bounds, count);
  if (focusedIndex === null) return grid;

  return grid.map((tileBounds, index) => (
    index === focusedIndex ? workspaceBounds(bounds) : { ...HIDDEN_BOUNDS }
  ));
}

module.exports = {
  calculateTiles,
  calculateViewBounds,
  chooseGrid,
  getToolbarHeight,
  workspaceBounds,
  GAP,
  HIDDEN_BOUNDS
};
