'use strict';

const address = document.querySelector('#address');
const back = document.querySelector('#back');
const forward = document.querySelector('#forward');
const reload = document.querySelector('#reload');
const reloadIcon = document.querySelector('#reloadIcon');
const add = document.querySelector('#add');
const close = document.querySelector('#close');
const count = document.querySelector('#count');
let state = { activeTile: 0, focusedTile: null, tiles: [] };

document.body.classList.add(`platform-${window.mosaic.platform}`);

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
  reload.dataset.loading = String(Boolean(active?.loading));
  reloadIcon.setAttribute('href', active?.loading ? 'icons.svg#x' : 'icons.svg#rotate-cw');
  reload.setAttribute('aria-label', active?.loading ? 'Stop loading' : 'Reload');
  reload.title = active?.loading ? 'Stop loading' : 'Reload';

  const tabLabel = `${next.tiles.length} ${next.tiles.length === 1 ? 'tab' : 'tabs'} open`;
  count.textContent = String(next.tiles.length);
  count.title = tabLabel;
  count.setAttribute('aria-label', tabLabel);
  document.body.classList.toggle('page-focused', next.focusedTile !== null);
}

window.mosaic.onState(render);
window.mosaic.onAddressFocus(() => {
  address.focus();
  address.select();
});

back.onclick = () => action('back');
forward.onclick = () => action('forward');
reload.onclick = () => action(reload.dataset.loading === 'true' ? 'stop' : 'reload');
add.onclick = () => action('add');
close.onclick = () => action('close', state.activeTile);
close.addEventListener('contextmenu', event => {
  event.preventDefault();
  if (state.tiles.length > 0) action('close-all');
});
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
