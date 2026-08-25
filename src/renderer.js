'use strict';
const tabs = document.querySelector('#tabs');
const address = document.querySelector('#address');
let state = { activeTile: 0, tiles: [] };

function action(name, payload) { window.mosaic.action(name, payload); }
function render(next) {
  state = next;
  tabs.replaceChildren(...next.tiles.map((tile, index) => {
    const button = document.createElement('button');
    button.className = `tab ${index === next.activeTile ? 'active' : ''}`;
    button.innerHTML = `<span class="num">0${index + 1}</span><span class="title"></span><span class="close">×</span>`;
    button.querySelector('.title').textContent = tile.title;
    button.onclick = event => event.target.classList.contains('close') ? action('close', index) : action('activate', index);
    return button;
  }));
  const active = next.tiles[next.activeTile];
  if (active && document.activeElement !== address) address.value = active.url;
  document.querySelector('#count').textContent = `${next.tiles.length} / 4 tiles`;
  document.querySelector('#add').disabled = next.tiles.length >= 4;
}

window.mosaic.onState(render);
document.querySelector('#add').onclick = () => action('add');
document.querySelector('#back').onclick = () => action('back');
document.querySelector('#forward').onclick = () => action('forward');
document.querySelector('#reload').onclick = () => action('reload');
document.querySelector('#addressForm').onsubmit = event => { event.preventDefault(); action('navigate', address.value); address.blur(); };
window.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l') { event.preventDefault(); address.focus(); address.select(); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 't') { event.preventDefault(); action('add'); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'w') { event.preventDefault(); action('close', state.activeTile); }
});
