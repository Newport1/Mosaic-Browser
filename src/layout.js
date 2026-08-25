'use strict';

const DEFAULT_SEARCH_URL = 'https://www.google.com/search?q=';

function normalizeInput(value, searchUrl = DEFAULT_SEARCH_URL) {
  const raw = String(value ?? '').trim();

  if (!raw) return null;
  if (/^https?:/i.test(raw)) return raw;
  if (/^[a-z][a-z\d+.-]*:/i.test(raw)) return `${searchUrl}${encodeURIComponent(raw)}`;
  if (/\s/.test(raw)) return `${searchUrl}${encodeURIComponent(raw)}`;

  return `https://${raw}`;
}

function chooseGrid(count, width, height, gap = 3) {
  const itemCount = Math.max(1, Math.floor(count));
  const viewportWidth = Math.max(1, width);
  const viewportHeight = Math.max(1, height);

  if (itemCount === 1) return { columns: 1, rows: 1 };

  let best = null;

  for (let columns = 1; columns <= itemCount; columns += 1) {
    const rows = Math.ceil(itemCount / columns);
    const tileWidth = Math.max(1, (viewportWidth - gap * (columns - 1)) / columns);
    const tileHeight = Math.max(1, (viewportHeight - gap * (rows - 1)) / rows);
    const unused = columns * rows - itemCount;
    const shapePenalty = Math.abs(Math.log(tileWidth / tileHeight));
    const wastePenalty = unused / itemCount;
    // Empty grid slots are visually expensive, so prefer a dense grid unless
    // an alternate shape is materially better for the current viewport.
    const score = shapePenalty + wastePenalty;

    if (!best || score < best.score) {
      best = { columns, rows, score };
    }
  }

  return { columns: best.columns, rows: best.rows };
}

function computeTileBounds(count, width, height, gap = 3) {
  if (count <= 0) return [];

  const viewportWidth = Math.max(0, Math.floor(width));
  const viewportHeight = Math.max(0, Math.floor(height));
  const { columns, rows } = chooseGrid(count, viewportWidth, viewportHeight, gap);
  const usableWidth = Math.max(0, viewportWidth - gap * (columns - 1));
  const usableHeight = Math.max(0, viewportHeight - gap * (rows - 1));

  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x0 = Math.round((column * usableWidth) / columns) + column * gap;
    const x1 = Math.round(((column + 1) * usableWidth) / columns) + column * gap;
    const y0 = Math.round((row * usableHeight) / rows) + row * gap;
    const y1 = Math.round(((row + 1) * usableHeight) / rows) + row * gap;

    return {
      x: x0,
      y: y0,
      width: Math.max(0, x1 - x0),
      height: Math.max(0, y1 - y0),
    };
  });
}

function contentBounds(tileBounds, chromeHeight) {
  const headerHeight = Math.min(chromeHeight, tileBounds.height);

  return {
    x: tileBounds.x,
    y: tileBounds.y + headerHeight,
    width: tileBounds.width,
    height: Math.max(0, tileBounds.height - headerHeight),
  };
}

module.exports = {
  DEFAULT_SEARCH_URL,
  chooseGrid,
  computeTileBounds,
  contentBounds,
  normalizeInput,
};
