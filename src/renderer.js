'use strict';

const address = document.querySelector('#address');
const back = document.querySelector('#back');
const forward = document.querySelector('#forward');
const reload = document.querySelector('#reload');
const close = document.querySelector('#close');
let state = { activeTile: 0, focusedTile: null, tiles: [] };

function action(name, payload) {
  return window.mosaic.action(name, payload);
}

function render(next) {
  state = next;
  const active = next.tiles[next.activeTile];

  if (active && document.activeElement !== address) address.value = active.url;
  back.disabled = !active?.canGoBack;
  forward.disabled = !active?.canGoForward;
  reload.disabled = !active;
  close.disabled = !active;
  document.querySelector('#count').textContent = `${next.tiles.length} ${next.tiles.length === 1 ? 'page' : 'pages'}`;
  document.body.classList.toggle('page-focused', next.focusedTile !== null);
}

window.mosaic.onState(render);
window.mosaic.onAddressFocus(() => {
  address.focus();
  address.select();
});

back.onclick = () => action('back');
forward.onclick = () => action('forward');
reload.onclick = () => action('reload');
close.onclick = () => action('close', state.activeTile);
document.querySelector('#addressForm').onsubmit = event => {
  event.preventDefault();
  action('navigate', address.value);
  address.blur();
};

window.addEventListener('keydown', event => {
  const primary = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();

  if (primary && key === 'l') {
    event.preventDefault();
    address.focus();
    address.select();
  }
  if (primary && key === 't') {
    event.preventDefault();
    action('add');
  }
  if (primary && key === 'w') {
    event.preventDefault();
    action('close', state.activeTile);
  }
  if (event.key === 'Escape' && state.focusedTile !== null) {
    event.preventDefault();
    action('restore');
  }
  if (event.key === 'F11') {
    event.preventDefault();
    action('toggle-fullscreen');
  }
});

action('set-reduced-motion', window.matchMedia('(prefers-reduced-motion: reduce)').matches);
