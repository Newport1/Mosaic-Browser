'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceDirectory = path.join(__dirname, '..', 'src');

test('every interface icon reference exists in the local symbol set', () => {
  const sprite = fs.readFileSync(path.join(sourceDirectory, 'icons.svg'), 'utf8');
  const markup = ['index.html', 'controls.html']
    .map(file => fs.readFileSync(path.join(sourceDirectory, file), 'utf8'))
    .join('\n');
  const iconIds = [...markup.matchAll(/href="icons\.svg#([\w-]+)"/g)].map(match => match[1]);

  assert.ok(iconIds.length > 0);
  iconIds.forEach(id => assert.match(sprite, new RegExp(`<symbol id="${id}"`)));
});
