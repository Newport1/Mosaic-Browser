'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CONFIRM_CLOSE_RESPONSE, createClosePrompt } = require('../src/close-prompt');

test('close prompt reports every open tab and defaults to cancel', () => {
  const prompt = createClosePrompt(12);

  assert.equal(prompt.message, 'Close Mosaic?');
  assert.equal(prompt.detail, '12 open tabs will be closed.');
  assert.deepEqual(prompt.buttons, ['Cancel', 'Close Mosaic']);
  assert.equal(prompt.defaultId, 0);
  assert.equal(prompt.cancelId, 0);
  assert.equal(CONFIRM_CLOSE_RESPONSE, 1);
});

test('close prompt uses the singular tab label', () => {
  assert.equal(createClosePrompt(1).detail, '1 open tab will be closed.');
});

test('close prompt handles an invalid count without inventing tabs', () => {
  assert.equal(createClosePrompt(-1).detail, '0 open tabs will be closed.');
});
