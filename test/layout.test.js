'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateTiles,
  calculateViewBounds,
  getToolbarHeight,
  workspaceBounds,
  HIDDEN_BOUNDS
} = require('../src/layout');

test('one tile fills the grid workspace', () => {
  assert.deepEqual(calculateTiles({ width: 1000, height: 700 }, 1), [
    { x: 6, y: 54, width: 988, height: 640 }
  ]);
});

test('layout supports arbitrary tile counts without overlap or overflow', () => {
  const bounds = { width: 1440, height: 900 };
  const tiles = calculateTiles(bounds, 17);
  assert.equal(tiles.length, 17);

  tiles.forEach((tile, index) => {
    assert.ok(tile.x >= 0 && tile.y >= getToolbarHeight(bounds.width));
    assert.ok(tile.x + tile.width <= bounds.width);
    assert.ok(tile.y + tile.height <= bounds.height);

    tiles.slice(index + 1).forEach(other => {
      const overlaps = tile.x < other.x + other.width
        && tile.x + tile.width > other.x
        && tile.y < other.y + other.height
        && tile.y + tile.height > other.y;
      assert.equal(overlaps, false);
    });
  });
});

test('adding pages shrinks tiles instead of enforcing a cap', () => {
  const bounds = { width: 1200, height: 800 };
  const four = calculateTiles(bounds, 4)[0];
  const twenty = calculateTiles(bounds, 20)[0];
  assert.ok(twenty.width * twenty.height < four.width * four.height);
  assert.equal(calculateTiles(bounds, 20).length, 20);
});

test('focus fills the workspace and restore returns the exact grid geometry', () => {
  const bounds = { width: 1000, height: 700 };
  const grid = calculateViewBounds(bounds, 7);
  const focused = calculateViewBounds(bounds, 7, 3);

  assert.deepEqual(focused[3], workspaceBounds(bounds));
  focused.forEach((tile, index) => {
    if (index !== 3) assert.deepEqual(tile, HIDDEN_BOUNDS);
  });
  assert.deepEqual(calculateViewBounds(bounds, 7, null), grid);
});

test('narrow windows use compact chrome geometry', () => {
  assert.equal(getToolbarHeight(500), 42);
  assert.equal(calculateTiles({ width: 500, height: 700 }, 1)[0].y, 48);
});
