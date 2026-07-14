import { REGISTRY } from './registry.js';
import { unpack } from './scramble.js';
import { cleanLabel } from './text.js';
import {
  listSaved, addSaved, removeSaved, formatSavedDate,
  encodeSavedBackup, restoreSavedBackup, NAV_KEY,
} from './saved.js';
import { addCardOutline } from './outline.js';
import { TRASH_ICON } from './icons.js';
import { HEX6, hexToRgb, trapTab } from './util.js';

const WORDMARK = '/icons/canid-logo.svg';

// ── List rendering ───────────────────────────────────────────────────────────

const listEl = document.getElementById('saved-list');
const emptyEl = document.getElementById('saved-empty');

function render() {
  listEl.replaceChildren();
  const cards = listSaved();

  if (cards.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  cards.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'saved-row';

    const card = document.createElement('a');
    card.className = 'link-card saved-card';
    card.href = '/c#' + entry.fragment;
    card.style.setProperty('--primary', `#${entry.p}`);
    card.style.setProperty('--primary-rgb', hexToRgb(entry.p));
    card.style.setProperty('--accent', `#${entry.a}`);
    card.style.setProperty('--accent-rgb', hexToRgb(entry.a));
    card.style.animationDelay = `${index * 60}ms`;
    card.addEventListener('click', e => { e.preventDefault(); openCard(entry.fragment); });

    const contentWrap = document.createElement('div');
    contentWrap.className = 'card-content-wrap';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'card-icon saved-icon';
    const logo = document.createElement('img');
    logo.src = WORDMARK;
    logo.alt = '';
    logo.width = 289;
    logo.height = 129;
    logo.className = 'saved-wordmark';
    iconWrap.appendChild(logo);

    const info = document.createElement('div');
    info.className = 'card-info';

    const platform = document.createElement('span');
    platform.className = 'card-platform';
    platform.textContent = formatSavedDate(entry.savedAt);

    const handle = document.createElement('span');
    handle.className = 'card-handle';
    if (entry.note) {
      handle.textContent = entry.note;
    } else {
      handle.textContent = 'Untitled card';
      handle.classList.add('untitled');
    }

    info.append(platform, handle);
    contentWrap.append(iconWrap, info);
    card.appendChild(contentWrap);
    addCardOutline(card);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'saved-remove-btn';
    removeBtn.innerHTML = TRASH_ICON;
    removeBtn.setAttribute('aria-label',
      `Remove ${entry.note || 'card saved ' + formatSavedDate(entry.savedAt)}`);
    removeBtn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openConfirm(entry);
    });

    row.style.animationDelay = `${index * 60}ms`;
    row.append(card, removeBtn);
    listEl.appendChild(row);
  });
}

// ── Remove confirmation ──────────────────────────────────────────────────────

const confirmOverlay = document.getElementById('confirm-overlay');
const confirmDialog = document.getElementById('confirm-dialog');
const confirmDescEl = document.getElementById('confirm-desc');
const confirmRemoveBtn = document.getElementById('confirm-remove');
const confirmCancelBtn = document.getElementById('confirm-cancel');
const confirmRegions = [document.querySelector('.v-header'), document.querySelector('main')];
let pendingRemoveId = null;
let confirmLastFocused = null;

function setConfirmInert(on) {
  for (const el of confirmRegions) {
    if (!el) continue;
    if (on) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }
}

function openConfirm(entry) {
  pendingRemoveId = entry.id;
  const which = entry.note ? `“${entry.note}”` : `the card saved ${formatSavedDate(entry.savedAt)}`;
  confirmDescEl.textContent =
    `This removes ${which} from your saved cards on this device. You can always add it again from its link.`;
  confirmLastFocused = document.activeElement;
  confirmOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  setConfirmInert(true);
  confirmCancelBtn.focus();
}

function closeConfirm() {
  confirmOverlay.hidden = true;
  pendingRemoveId = null;
  document.body.style.overflow = '';
  setConfirmInert(false);
  if (confirmLastFocused && confirmLastFocused.focus) confirmLastFocused.focus();
}

confirmRemoveBtn.addEventListener('click', () => {
  if (pendingRemoveId) removeSaved(pendingRemoveId);
  closeConfirm();
  render();
});
confirmCancelBtn.addEventListener('click', closeConfirm);
confirmOverlay.addEventListener('click', e => { if (e.target === confirmOverlay) closeConfirm(); });
document.addEventListener('keydown', e => {
  if (confirmOverlay.hidden) return;
  if (e.key === 'Escape') closeConfirm();
  else trapTab(e, confirmDialog);
});

// Flag the navigation so the viewer shows its back button, then open the card.
function openCard(fragment) {
  try { sessionStorage.setItem(NAV_KEY, 'saved'); } catch (_) {}
  location.href = '/c#' + fragment;
}

// ── Add by link ──────────────────────────────────────────────────────────────

function parseCardLink(text) {
  let raw = (text || '').trim();
  if (!raw) return null;
  const hashAt = raw.indexOf('#');
  if (hashAt !== -1) raw = raw.slice(hashAt + 1);
  if (!raw) return null;

  let params;
  try { params = new URLSearchParams(unpack(raw)); }
  catch (_) { return null; }

  let hasHandle = false;
  for (const [key, val] of params.entries()) {
    if (key === 'p' || key === 'a' || key === 'nm' || key.startsWith('lbl_')) continue;
    const base = key.replace(/_\d+$/, '');
    if (REGISTRY.some(r => r.key === base) && val.trim()) { hasHandle = true; break; }
  }
  if (!hasHandle) return null;

  const p = HEX6.test(params.get('p') || '') ? params.get('p') : undefined;
  const a = HEX6.test(params.get('a') || '') ? params.get('a') : undefined;
  return { fragment: raw, note: cleanLabel(params.get('nm') || ''), p, a };
}

const addInput = document.getElementById('add-link-input');
const addBtn = document.getElementById('add-link-btn');
const addMsg = document.getElementById('add-link-msg');

function showAddMsg(text, ok) {
  addMsg.textContent = text;
  addMsg.hidden = false;
  addMsg.classList.toggle('is-error', !ok);
}

addBtn.addEventListener('click', () => {
  const parsed = parseCardLink(addInput.value);
  if (!parsed) { showAddMsg("That doesn’t look like a canid card link.", false); return; }
  addSaved(parsed);
  addInput.value = '';
  showAddMsg('Card saved.', true);
  render();
});
addInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });

// ── Backup / restore ─────────────────────────────────────────────────────────

const backupBtn = document.getElementById('backup-btn');
const restoreBtn = document.getElementById('restore-btn');
const backupOut = document.getElementById('backup-out');
const restoreIn = document.getElementById('restore-in');
const backupCode = document.getElementById('backup-code');
const backupCopy = document.getElementById('backup-copy');
const restoreCode = document.getElementById('restore-code');
const restoreGo = document.getElementById('restore-go');
const backupMsg = document.getElementById('backup-msg');

function showBackupMsg(text, ok) {
  backupMsg.textContent = text;
  backupMsg.hidden = false;
  backupMsg.classList.toggle('is-error', !ok);
}

backupBtn.addEventListener('click', () => {
  if (listSaved().length === 0) { showBackupMsg('No saved cards to back up yet.', false); return; }
  backupCode.value = encodeSavedBackup();
  backupOut.hidden = false;
  restoreIn.hidden = true;
  backupMsg.hidden = true;
  backupCode.focus();
  backupCode.select();
});

backupCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(backupCode.value);
    showBackupMsg('Backup code copied. Keep it somewhere safe.', true);
  } catch (_) {
    backupCode.select();
    showBackupMsg('Select the code above and copy it.', false);
  }
});

restoreBtn.addEventListener('click', () => {
  restoreIn.hidden = !restoreIn.hidden;
  backupOut.hidden = true;
  backupMsg.hidden = true;
  if (!restoreIn.hidden) restoreCode.focus();
});

restoreGo.addEventListener('click', () => {
  try {
    const { added, total } = restoreSavedBackup(restoreCode.value);
    restoreCode.value = '';
    restoreIn.hidden = true;
    showBackupMsg(added === 0
      ? `Restored. No new cards (you already had them all). ${total} saved.`
      : `Restored ${added} card${added === 1 ? '' : 's'}. ${total} saved.`, true);
    render();
  } catch (_) {
    showBackupMsg("That backup code couldn’t be read.", false);
  }
});

render();
