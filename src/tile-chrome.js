'use strict';

const address = document.querySelector('#address');
const back = document.querySelector('#back');
const forward = document.querySelector('#forward');
const reload = document.querySelector('#reload');
const close = document.querySelector('#close');
const count = document.querySelector('#count');
const hitTarget = document.querySelector('#hit-target');

let state = {
  active: false,
  focused: false,
  loading: false,
  url: '',
};

function send(action, value) {
  window.tileApi.action(action, value);
}

function update(nextState) {
  state = { ...state, ...nextState };
  document.body.classList.toggle('active', state.active);
  document.body.classList.toggle('focused', state.focused);
  back.disabled = !state.canGoBack;
  forward.disabled = !state.canGoForward;
  reload.textContent = state.loading ? '×' : '↻';
  reload.title = state.loading ? 'Stop' : 'Reload';
  reload.setAttribute('aria-label', state.loading ? 'Stop loading' : 'Reload');
  count.textContent = `${state.index}/${state.total}`;

  if (document.activeElement !== address) address.value = state.url || '';
}

back.addEventListener('click', () => send('back'));
forward.addEventListener('click', () => send('forward'));
reload.addEventListener('click', () => send('reload'));
close.addEventListener('click', () => send('close'));
hitTarget.addEventListener('click', () => send('focus'));

document.querySelector('#chrome').addEventListener('pointerdown', () => send('activate'));

address.addEventListener('focus', () => {
  send('activate');
  address.select();
});

address.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    send('navigate', address.value);
    address.blur();
  } else if (event.key === 'Escape') {
    address.blur();
  }
});

window.tileApi.onState(update);
window.tileApi.onFocusAddress(() => {
  address.focus();
  address.select();
});
