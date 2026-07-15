// Viewer parses the URL fragment and renders link cards.
// Security-critical: all fragment values are attacker-controllable.
// No innerHTML with untrusted data. All DOM construction uses DOM APIs.

import { REGISTRY, byDisplayOrder, urlAllowed } from './registry.js';
import { fontByCode } from './fonts.js';
import { BRAND_ICONS } from './icons.js';
import { unpack } from './scramble.js';
import { cleanLabel } from './text.js';
import { addSaved, findSaved, updateNote, removeSaved, formatSavedDate, NAV_KEY } from './saved.js';
import { addCardOutline } from './outline.js';
import { exportContact } from './vcard.js';
import { validHex, hexToRgb, contrast, trapTab, DEFAULT_P, DEFAULT_A } from './util.js';

const RAW_FRAGMENT = location.hash.slice(1);

const MAX_PAIRS = 100;
const MAX_KEY_LEN = 64;
const MAX_VAL_LEN = 2048;

function capParams(p) {
  const out = new URLSearchParams();
  let n = 0;
  for (const [k, v] of p) {
    if (n++ >= MAX_PAIRS) break;
    if (k.length <= MAX_KEY_LEN && v.length <= MAX_VAL_LEN) out.append(k, v);
  }
  return out;
}

function readParams() {
  const raw = location.hash.slice(1);
  const str = unpack(raw);
  return capParams(new URLSearchParams(str));
}

const params = readParams();

window.addEventListener('hashchange', () => location.reload());

// ── Colors ─────────────────────────────────────────────────────────────────

const CARD_SURFACE = '231f1c';

function liftForDark(hex) {
  if (contrast(hex, CARD_SURFACE) >= 4.5) return hex;
  let [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < 64; i++) {
    r = Math.min(255, r + 4); g = Math.min(255, g + 4); b = Math.min(255, b + 4);
    const h = [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    if (contrast(h, CARD_SURFACE) >= 4.5) return h;
  }
  return 'f2f2f2';
}

const p = validHex(params.get('p') || '') ? params.get('p') : DEFAULT_P;
const a = validHex(params.get('a') || '') ? params.get('a') : DEFAULT_A;
const pUI = liftForDark(p);
const aUI = liftForDark(a);
document.documentElement.style.setProperty('--primary', `#${pUI}`);
document.documentElement.style.setProperty('--primary-rgb', hexToRgb(pUI));
document.documentElement.style.setProperty('--accent', `#${aUI}`);
document.documentElement.style.setProperty('--accent-rgb', hexToRgb(aUI));

const cardFont = fontByCode(params.get('f') || 'k');
if (cardFont.code !== 'k') {
  document.documentElement.style.setProperty('--card-font', cardFont.css);
  document.documentElement.classList.add('alt-font');
}

function mixHex(a, b, t) {
  const A = parseInt(a, 16), B = parseInt(b, 16);
  return [16, 8, 0]
    .map(sh => Math.round((A >> sh & 255) * t + (B >> sh & 255) * (1 - t)).toString(16).padStart(2, '0'))
    .join('');
}
document.querySelector('meta[name="theme-color"]')
  ?.setAttribute('content', `#${mixHex(p, '0c0a08', 0.25)}`);


function baseKey(k) { return k.replace(/_\d+$/, ''); }

function mapHref(query) {
  const q = encodeURIComponent(query);
  const apple = /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(navigator.userAgent || '');
  return apple
    ? `https://maps.apple.com/?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

const labels = {};
for (const [key, rawVal] of params.entries()) {
  if (!key.startsWith('lbl_')) continue;
  const clean = cleanLabel(rawVal);
  if (clean) labels[key.slice(4)] = clean;
}

const displayName = cleanLabel(params.get('nm') || '');
if (displayName) {
  const nameEl = document.getElementById('v-name');
  nameEl.textContent = displayName;
  nameEl.hidden = false;
  document.getElementById('v-logo').hidden = true;
  document.getElementById('cta-watermark').hidden = false;
}

const entries = [];
for (const [key, rawVal] of params.entries()) {
  if (key === 'p' || key === 'a' || key === 'nm' || key === 'f' || key.startsWith('lbl_')) continue;
  const base = baseKey(key);
  const reg = REGISTRY.find(r => r.key === base);
  if (!reg) continue;

  const val = rawVal.trim();
  if (!val) continue;

  const canLabel = reg.urlType || reg.idType || reg.mapType || reg.noteType
    || reg.endpoint === 'mailto:' || reg.endpoint === 'tel:';
  const label = canLabel ? (labels[key] || null) : null;

  if (reg.urlType) {
    let href;
    try {
      const u = new URL(val);
      if (u.protocol !== 'https:') continue;
      if (!urlAllowed(reg, u.href)) continue;
      href = u.href;
    } catch (_) { continue; }
    entries.push({ key, base, reg, val, href, label });
  } else {
    if (!reg.re.test(val)) continue;
    let href = null;
    if (reg.mapType) {
      href = mapHref(val);
    } else if (reg.endpoint === 'mailto:') {
      href = `mailto:${val}`;
    } else if (!reg.displayOnly && reg.endpoint) {
      href = reg.endpoint + val + (reg.suffix || '');
    }
    entries.push({ key, base, reg, val, href, label });
  }
}

entries.sort((a, b) => {
  const c = byDisplayOrder(a.reg, b.reg);
  if (c !== 0) return c;
  return a.key.localeCompare(b.key);
});


const container = document.getElementById('links-container');
const empty = document.getElementById('empty-state');

if (entries.length === 0) {
  empty.hidden = false;
  if (RAW_FRAGMENT) {
    empty.textContent = 'This card has nothing to show. Its link may have been cut off in transit — '
      + 'a canid card lives entirely inside its link. Ask whoever shared it for a fresh QR code or link.';
  }
} else {
  entries.forEach((entry, index) => {
    const { reg, val, href, base, label } = entry;
    // Custom links must pass through the warning dialog
    const warnGated = !!href && reg.urlType && !reg.host;
    const card = document.createElement(
      warnGated || reg.displayOnly || reg.noteType ? 'button' : href ? 'a' : 'div');

    if (warnGated) {
      card.type = 'button';
      card.addEventListener('click', () => openWarn(href));
    } else if (reg.noteType) {
      card.type = 'button';
      card.setAttribute('aria-label', `Read ${label || reg.label}`);
      card.addEventListener('click', () => openNote(val, label || reg.label));
    } else if (href) {
      card.href = href;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
    } else if (reg.displayOnly) {
      card.type = 'button';
      card.setAttribute('aria-label', `Copy ${reg.label} handle`);
      card.addEventListener('click', () => copyAndOffer(val, reg));
    }

    card.className = 'link-card' + (reg.displayOnly ? ' display-only' : '');
    card.style.animationDelay = `${index * 60}ms`;

    const contentWrap = document.createElement('div');
    contentWrap.className = 'card-content-wrap';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'card-icon';
    iconWrap.innerHTML = BRAND_ICONS[base] || BRAND_ICONS.url || '';

    const info = document.createElement('div');
    info.className = 'card-info';

    const opaqueValue = reg.host || reg.idType;

    const platform = document.createElement('span');
    platform.className = 'card-platform';
    const baseLabel = reg.pathLabel && val.includes('/') ? reg.pathLabel : reg.label;
    platform.textContent = opaqueValue ? reg.label : (label || baseLabel);

    const handle = document.createElement('span');
    handle.className = 'card-handle';
    handle.dir = 'auto';
    const prefix = reg.prefix !== undefined ? reg.prefix : '@';
    handle.textContent = opaqueValue
      ? (label || (href ? new URL(href).hostname : reg.label))
      : reg.urlType
        ? new URL(href).hostname
        : reg.endpoint === 'mailto:'
          ? val
          : reg.suffix
            ? `${val}${reg.suffix}`
            : `${prefix}${val}`;

    info.appendChild(platform);
    info.appendChild(handle);

    contentWrap.appendChild(iconWrap);
    contentWrap.appendChild(info);

    card.appendChild(contentWrap);

    container.appendChild(card);
    addCardOutline(card);
  });

  const FADE_W = 32;

  const markOverflow = el => {
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 1) {
      el.classList.remove('overflows');
      el.style.removeProperty('--fade-w');
      return;
    }
    el.classList.add('overflows');
    const remaining = Math.max(0, Math.min(FADE_W, max - el.scrollLeft));
    el.style.setProperty('--fade-w', `${remaining}px`);
  };

  const markAll = () => {
    for (const el of container.querySelectorAll('.card-handle')) markOverflow(el);
  };

  for (const el of container.querySelectorAll('.card-handle')) {
    el.addEventListener('scroll', () => markOverflow(el), { passive: true });
  }
  markAll();
  document.fonts?.ready?.then(markAll);
  window.addEventListener('resize', markAll);
}

// ── Shared modal a11y ────────────────────────────────────────────────────────
const pageRegions = [document.querySelector('.v-header'), document.querySelector('main')];
let lastFocused = null;

function setPageInert(on) {
  for (const el of pageRegions) {
    if (!el) continue;
    if (on) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }
}

const warnOverlay = document.getElementById('warn-overlay');
const warnDialog = document.getElementById('warn-dialog');
const warnHostEl = document.getElementById('warn-host');
const warnFullEl = document.getElementById('warn-full');
const warnIdnEl = document.getElementById('warn-idn');
let pendingHref = null;

function openWarn(href) {
  pendingHref = href;
  warnFullEl.textContent = href;
  let host = href;
  try { host = new URL(href).hostname; } catch (_) {}
  warnHostEl.textContent = host;
  warnIdnEl.hidden = !host.split('.').some(label => label.startsWith('xn--'));
  warnFullEl.scrollLeft = 0;
  lastFocused = document.activeElement;
  warnOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  setPageInert(true);
  document.getElementById('warn-cancel').focus();
}

function closeWarn() {
  warnOverlay.hidden = true;
  pendingHref = null;
  document.body.style.overflow = '';
  setPageInert(false);
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

document.getElementById('warn-cancel').addEventListener('click', closeWarn);
document.getElementById('warn-go').addEventListener('click', () => {
  if (pendingHref) window.open(pendingHref, '_blank', 'noopener,noreferrer');
  closeWarn();
});
warnOverlay.addEventListener('click', e => { if (e.target === warnOverlay) closeWarn(); });
document.addEventListener('keydown', e => {
  if (warnOverlay.hidden) return;
  if (e.key === 'Escape') closeWarn();
  else trapTab(e, warnDialog);
});


// ── Copy interstitial (display-only cards) ───────────────────────────────────

const copyOverlay = document.getElementById('copy-overlay');
const copyDialog = document.getElementById('copy-dialog');
const copyHandleEl = document.getElementById('copy-handle');
const copyDescEl = document.getElementById('copy-desc');
const copyGoBtn = document.getElementById('copy-go');
let pendingSite = null;

async function copyAndOffer(val, reg) {
  try {
    await navigator.clipboard.writeText(val);
  } catch (_) {
    window.prompt(`Copy this ${reg.label} handle:`, val);
    return;
  }
  openCopy(val, reg);
}

function openCopy(val, reg) {
  pendingSite = reg.site || null;
  copyHandleEl.textContent = val;
  if (pendingSite) {
    copyGoBtn.hidden = false;
    copyGoBtn.textContent = `Go to ${reg.label}`;
    copyDescEl.textContent = `Open ${reg.label} and paste it to find them.`;
  } else {
    copyGoBtn.hidden = true;
    copyDescEl.textContent = 'Paste it on the app to find them.';
  }
  lastFocused = document.activeElement;
  copyOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  setPageInert(true);
  document.getElementById('copy-cancel').focus();
}

function closeCopy() {
  copyOverlay.hidden = true;
  pendingSite = null;
  document.body.style.overflow = '';
  setPageInert(false);
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

document.getElementById('copy-cancel').addEventListener('click', closeCopy);
copyGoBtn.addEventListener('click', () => {
  if (pendingSite) window.open(pendingSite, '_blank', 'noopener,noreferrer');
  closeCopy();
});
copyOverlay.addEventListener('click', e => { if (e.target === copyOverlay) closeCopy(); });
document.addEventListener('keydown', e => {
  if (copyOverlay.hidden) return;
  if (e.key === 'Escape') closeCopy();
  else trapTab(e, copyDialog);
});


// ── Note viewer (note cards) ─────────────────────────────────────────────────
// The note is attacker-controlled free text: it only ever reaches the page as
// textContent, and nothing here turns it into a link. See registry.js.

const noteOverlay = document.getElementById('note-overlay');
const noteDialog = document.getElementById('note-dialog');
const noteTitleEl = document.getElementById('note-title');
const noteBodyEl = document.getElementById('note-body');
const noteCopyBtn = document.getElementById('note-copy');
let pendingNote = '';
let copyResetTimer = null;

function resetCopyBtn() {
  clearTimeout(copyResetTimer);
  noteCopyBtn.textContent = 'Copy';
  noteCopyBtn.disabled = false;
}

function openNote(text, title) {
  pendingNote = text;
  noteTitleEl.textContent = title;
  noteBodyEl.textContent = text;
  noteBodyEl.scrollTop = 0;
  resetCopyBtn();
  lastFocused = document.activeElement;
  noteOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  setPageInert(true);
  noteDialog.focus();
}

function closeNote() {
  noteOverlay.hidden = true;
  pendingNote = '';
  resetCopyBtn();
  document.body.style.overflow = '';
  setPageInert(false);
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

noteCopyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(pendingNote);
    noteCopyBtn.textContent = 'Copied ✓';
    copyResetTimer = setTimeout(resetCopyBtn, 2000);
  } catch (_) {
    window.prompt('Copy this note:', pendingNote);
  }
});

document.getElementById('note-close').addEventListener('click', closeNote);
noteOverlay.addEventListener('click', e => { if (e.target === noteOverlay) closeNote(); });
document.addEventListener('keydown', e => {
  if (noteOverlay.hidden) return;
  if (e.key === 'Escape') closeNote();
  else trapTab(e, noteDialog);
});


// ── Back button ───────────────────────

const cameFromSaved = (() => {
  try {
    const v = sessionStorage.getItem(NAV_KEY) === 'saved';
    sessionStorage.removeItem(NAV_KEY);
    return v;
  } catch (_) { return false; }
})();

const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const internalReferrer = (() => {
  try { return !!document.referrer && new URL(document.referrer).origin === location.origin; }
  catch (_) { return false; }
})();
const freshLaunch = isStandalone && !cameFromSaved && !internalReferrer;

const backBtn = document.getElementById('v-back');
if (cameFromSaved) {
  backBtn.hidden = false;
  backBtn.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else location.href = '/saved';
  });
} else if (freshLaunch) {
  backBtn.hidden = false;
  backBtn.setAttribute('aria-label', 'Back to editor');

  history.pushState({ canidGuard: true }, '');
  let leaving = false;
  window.addEventListener('popstate', () => {
    if (leaving) return;
    leaving = true;
    location.replace('/');
  });

  backBtn.addEventListener('click', () => history.back());
}


// ── Save ──────────────────────────────────────────────────────────

const saveBtn = document.getElementById('v-save');
const saveOverlay = document.getElementById('save-overlay');
const saveDialog = document.getElementById('save-dialog');
const saveNoteEl = document.getElementById('save-note');
const saveTitleEl = document.getElementById('save-title');
const saveDescEl = document.getElementById('save-desc');
const saveHintEl = document.getElementById('save-hint');
const saveRemoveBtn = document.getElementById('save-remove');
const saveConfirmBtn = document.getElementById('save-confirm');

// Empty cards (no valid links) aren't worth saving and have no fragment value.
if (!RAW_FRAGMENT || entries.length === 0) {
  saveBtn.hidden = true;
}

let currentSaved = RAW_FRAGMENT ? findSaved(RAW_FRAGMENT) : null;

function reflectSavedState() {
  if (currentSaved) {
    saveBtn.classList.add('is-saved');
    saveBtn.textContent = 'Saved ✓';
    saveBtn.setAttribute('aria-label', 'Saved. Edit or remove');
  } else {
    saveBtn.classList.remove('is-saved');
    saveBtn.textContent = 'Save';
    saveBtn.removeAttribute('aria-label');
  }
}
reflectSavedState();

function openSave() {
  const editing = !!currentSaved;
  saveTitleEl.textContent = editing ? 'Saved card' : 'Save to your cards';
  saveDescEl.textContent = editing
    ? 'Rename this card or remove it from your saved cards.'
    : 'Name this card so you can find it later.';
  saveNoteEl.value = editing ? currentSaved.note : (displayName || '');
  saveHintEl.textContent = editing
    ? `Saved ${formatSavedDate(currentSaved.savedAt)}`
    : "Saved cards live on this device. Back them up so you don’t have to add them all again.";
  saveRemoveBtn.hidden = !editing;
  saveConfirmBtn.textContent = editing ? 'Done' : 'Save';

  lastFocused = document.activeElement;
  saveOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  setPageInert(true);
  saveDialog.focus();
}

function closeSave() {
  saveOverlay.hidden = true;
  document.body.style.overflow = '';
  setPageInert(false);
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

function confirmSave() {
  const note = saveNoteEl.value;
  if (currentSaved) {
    updateNote(currentSaved.id, note);
    currentSaved.note = cleanLabel(note);
  } else {
    currentSaved = addSaved({ fragment: RAW_FRAGMENT, note, p, a });
  }
  reflectSavedState();
  closeSave();
}

function removeCurrent() {
  if (currentSaved) {
    removeSaved(currentSaved.id);
    currentSaved = null;
  }
  reflectSavedState();
  closeSave();
}

saveBtn.addEventListener('click', openSave);
saveConfirmBtn.addEventListener('click', confirmSave);
saveRemoveBtn.addEventListener('click', removeCurrent);
document.getElementById('save-cancel').addEventListener('click', closeSave);
saveOverlay.addEventListener('click', e => { if (e.target === saveOverlay) closeSave(); });
saveNoteEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); confirmSave(); } });
document.addEventListener('keydown', e => {
  if (saveOverlay.hidden) return;
  if (e.key === 'Escape') closeSave();
  else trapTab(e, saveDialog);
});


// ── Add to contacts (vCard export) ───────────────────────────────────────────
const vcardBtn = document.getElementById('v-vcard');
if (vcardBtn) {
  vcardBtn.addEventListener('click', async () => {
    vcardBtn.disabled = true;
    try {
      await exportContact({ entries, name: displayName, cardUrl: location.href });
      closeSave();
    } catch (_) {
      // best-effort: leave the sheet open if export failed
    } finally {
      vcardBtn.disabled = false;
    }
  });
}
