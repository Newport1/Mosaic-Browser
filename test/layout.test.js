'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  chooseGrid,
  computeTileBounds,
  contentBounds,
  normalizeInput,
} = require('../src/layout');

test('five pages produce five tiles instead of stopping at four', () => {
  const rects = computeTileBounds(5, 1600, 900);
  assert.equal(rects.length, 5);
  rects.forEach((rect) => {
    assert.ok(rect.width > 0);
    assert.ok(rect.height > 0);
  });
});

test('the layout has no application tile ceiling', () => {
  for (const count of [1, 2, 4, 5, 12, 32, 64]) {
    assert.equal(computeTileBounds(count, 3840, 2160).length, count);
  }
});

test('grid selection uses the available viewport shape', () => {
  assert.deepEqual(chooseGrid(4, 1600, 900), { columns: 2, rows: 2 });
  assert.deepEqual(chooseGrid(3, 1800, 700), { columns: 3, rows: 1 });
});

test('every grid rectangle stays inside the viewport', () => {
  const width = 1919;
  const height = 1079;

  for (const rect of computeTileBounds(17, width, height)) {
    assert.ok(rect.x >= 0);
    assert.ok(rect.y >= 0);
    assert.ok(rect.x + rect.width <= width);
    assert.ok(rect.y + rect.height <= height);
  }
});

test('content starts below tile chrome', () => {
  assert.deepEqual(contentBounds({ x: 10, y: 20, width: 300, height: 200 }, 38), {
    x: 10,
    y: 58,
    width: 300,
    height: 162,
  });
});

test('address input accepts URLs, hostnames, and searches', () => {
  assert.equal(normalizeInput('https://example.com/a'), 'https://example.com/a');
  assert.equal(normalizeInput('example.com'), 'https://example.com');
  assert.equal(normalizeInput('tile browser idea'), 'https://www.google.com/search?q=tile%20browser%20idea');
  assert.equal(normalizeInput('file:///tmp/private'), 'https://www.google.com/search?q=file%3A%2F%2F%2Ftmp%2Fprivate');
  assert.equal(normalizeInput('   '), null);
});
