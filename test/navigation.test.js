'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isAllowedExternalUrl,
  isBrowsableUrl,
  isUserNavigableUrl,
  normalizeInput
} = require('../src/navigation');

test('web content can only initiate HTTP(S) navigation', () => {
  assert.equal(isBrowsableUrl('https://example.com/path'), true);
  assert.equal(isBrowsableUrl('HTTP://example.com'), true);
  assert.equal(isBrowsableUrl('file:///tmp/payload'), false);
  assert.equal(isBrowsableUrl('not a url'), false);
});

test('the trusted address bar accepts browser-native URL schemes', () => {
  assert.equal(isUserNavigableUrl('about:blank'), true);
  assert.equal(isUserNavigableUrl('data:text/plain,hello'), true);
  assert.equal(isUserNavigableUrl('file:///tmp/example.html'), true);
  assert.equal(isUserNavigableUrl('javascript:alert(1)'), false);
});

test('address input resolves URLs and searches consistently', () => {
  assert.equal(normalizeInput(''), null);
  assert.equal(normalizeInput('example.com/path'), 'https://example.com/path');
  assert.equal(normalizeInput('about:blank'), 'about:blank');
  assert.equal(normalizeInput('mosaic browser'), 'https://www.google.com/search?q=mosaic%20browser');
});

test('only mailto URLs can invoke an external protocol handler', () => {
  assert.equal(isAllowedExternalUrl('mailto:user@example.com'), true);
  assert.equal(isAllowedExternalUrl('MAILTO:user@example.com'), true);
  assert.equal(isAllowedExternalUrl('custom-protocol://payload'), false);
  assert.equal(isAllowedExternalUrl('file:///tmp/payload'), false);
});
