'use strict';

const TOOLBAR_HEIGHT = 92;
const GAP = 8;

function calculateTiles(bounds, count) {
  if (!count) return [];
  const availableWidth = Math.max(0, bounds.width - GAP * 2);
  const availableHeight = Math.max(0, bounds.height - TOOLBAR_HEIGHT - GAP);
  const columns = count === 1 ? 1 : count === 2 ? 2 : 2;
  const rows = Math.ceil(count / columns);
  const width = Math.floor((availableWidth - GAP * (columns - 1)) / columns);
  const height = Math.floor((availableHeight - GAP * (rows - 1)) / rows);

  return Array.from({ length: count }, (_, index) => ({
    x: GAP + (index % columns) * (width + GAP),
    y: TOOLBAR_HEIGHT + Math.floor(index / columns) * (height + GAP),
    width: index === count - 1 && count % columns === 1 ? availableWidth : width,
    height
  }));
}

module.exports = { calculateTiles, TOOLBAR_HEIGHT };
