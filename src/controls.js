'use strict';

const action = document.querySelector('#action');
let mode = 'overview';

function render() {
  if (mode === 'focused') {
    action.setAttribute('aria-label', 'Return page to grid');
    action.title = 'Return page to grid (Escape)';
    action.innerHTML = '<span class="overview-icon" aria-hidden="true"><span></span><span></span><span></span><span></span></span>';
  } else {
    action.setAttribute('aria-label', 'New page');
    action.title = 'New page (Ctrl/Cmd+T)';
    action.textContent = '+';
  }
}

action.addEventListener('click', () => {
  window.controlsApi.action(mode === 'focused' ? 'restore' : 'new');
});

window.controlsApi.onState((state) => {
  mode = state.mode;
  render();
});

render();
