'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedExternalUrl, isBrowsableUrl } = require('../src/navigation');

test('only HTTP(S) URLs can be loaded in a tile', () => {
  assert.equal(isBrowsableUrl('https://example.com/path'), true);
  assert.equal(isBrowsableUrl('HTTP://example.com'), true);
  assert.equal(isBrowsableUrl('mailto:user@example.com'), false);
  assert.equal(isBrowsableUrl('not a url'), false);
});

test('only mailto URLs can invoke an external protocol handler', () => {
  assert.equal(isAllowedExternalUrl('mailto:user@example.com'), true);
  assert.equal(isAllowedExternalUrl('MAILTO:user@example.com'), true);
  assert.equal(isAllowedExternalUrl('custom-protocol://payload'), false);
  assert.equal(isAllowedExternalUrl('file:///tmp/payload'), false);
  assert.equal(isAllowedExternalUrl('not a url'), false);
});
