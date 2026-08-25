'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateTiles } = require('../src/layout');

test('one tile fills the workspace', () => {
  assert.deepEqual(calculateTiles({ width: 1000, height: 700 }, 1), [{ x: 8, y: 92, width: 984, height: 600 }]);
});

test('four tiles form an even grid', () => {
  const tiles = calculateTiles({ width: 1000, height: 700 }, 4);
  assert.equal(tiles.length, 4);
  assert.deepEqual(tiles[0], { x: 8, y: 92, width: 488, height: 296 });
  assert.deepEqual(tiles[3], { x: 504, y: 396, width: 488, height: 296 });
});

test('third tile spans the second row', () => {
  assert.equal(calculateTiles({ width: 1000, height: 700 }, 3)[2].width, 984);
});
