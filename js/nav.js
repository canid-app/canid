// Shared site-header nav (landing, FAQ, terms). Self-initializing.
import { UI_ICONS } from './icons.js';

const toggle = document.getElementById('lp-nav-toggle');
const nav = document.getElementById('lp-nav');

if (toggle && nav) {
  const bar = toggle.closest('.lp-bar');
  const icon = toggle.querySelector('.ui-icon');
  const setOpen = open => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (icon) icon.innerHTML = open ? UI_ICONS.close : UI_ICONS.menu;
  };
  setOpen(false);
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('click', e => {
    if (nav.classList.contains('open') && !e.composedPath().includes(bar)) setOpen(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('open')) setOpen(false);
  });
}
