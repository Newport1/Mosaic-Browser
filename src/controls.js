'use strict';

const restore = document.querySelector('#restore');

window.mosaic.onState(state => {
  restore.hidden = state.focusedTile === null || state.transitioning;
});

restore.onclick = () => window.mosaic.action('restore');
