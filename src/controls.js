'use strict';

const gridActions = document.querySelector('#gridActions');
const restore = document.querySelector('#restore');

window.mosaic.onState(state => {
  const focused = state.focusedTile !== null;
  gridActions.hidden = focused || state.transitioning;
  restore.hidden = !focused || state.transitioning;
});

document.querySelector('#add').onclick = () => window.mosaic.action('add');
document.querySelector('#fullscreen').onclick = () => window.mosaic.action('toggle-fullscreen');
restore.onclick = () => window.mosaic.action('restore');
