'use strict';

const CONFIRM_CLOSE_RESPONSE = 1;

function createClosePrompt(tabCount) {
  const count = Number.isInteger(tabCount) && tabCount > 0 ? tabCount : 0;
  const detail = count === 1
    ? '1 open tab will be closed.'
    : `${count} open tabs will be closed.`;

  return {
    type: 'question',
    title: 'Mosaic',
    message: 'Close Mosaic?',
    detail,
    buttons: ['Cancel', 'Close Mosaic'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  };
}

module.exports = { CONFIRM_CLOSE_RESPONSE, createClosePrompt };
