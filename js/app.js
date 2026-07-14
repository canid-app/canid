import { REGISTRY, byDisplayOrder, isValidValue } from './registry.js';
import { FONTS } from './fonts.js';
import { BRAND_ICONS, UI_ICONS, PENCIL_ICON, TRASH_ICON } from './icons.js';
import { hexToRgb } from './util.js';
import {
  loadOrRestore, debouncedSave, flushSave, ensurePersistence,
  decodeBackupInput, markBackedUp, needsBackup, clearBackupFragment, onSaveError,
  encodeAllBackup, backupJSON, restoreBackup,
  listProfiles, getActiveId, getActiveProfile, switchActive,
  createProfile, renameProfile, deleteProfile,
} from './store.js';
import { buildQR, downloadQR } from './qr.js';
import { buildShareData, lengthLevel } from './share.js';
import { renderFAQ } from './faq.js';
import { sanitizeText } from './text.js';
import { addCardOutline } from './outline.js';
import './nav.js';

// ── State ──────────────────────────────────────────────────────────────────

let profile = null;
let activeBucketId = null;
let wakeLock = null;
let wantWakeLock = false;
let backupRevealed = false;

const copiedURLs = {};

const ACTIVE_BUCKET_KEY = 'canid:activeBucket';

function rememberActiveBucket() {
  try {
    sessionStorage.setItem(ACTIVE_BUCKET_KEY, JSON.stringify({ id: profile.id, bucketId: activeBucketId }));
  } catch (_) {}
}

function recallActiveBucket() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(ACTIVE_BUCKET_KEY) || 'null');
    if (saved && saved.id === profile.id && profile.buckets.some(b => b.id === saved.bucketId)) {
      return saved.bucketId;
    }
  } catch (_) {}
  return profile.defaultBucketId;
}

function setActiveBucket(id) {
  activeBucketId = id;
  rememberActiveBucket();
}

// ── Boot ───────────────────────────────────────────────────────────────────

async function init() {
  onSaveError(() => toast("Couldn’t save. Your browser may be in private mode. Back up your card."));

  const { profile: loaded, restored, pendingRestore } = loadOrRestore();
  profile = loaded;
  activeBucketId = recallActiveBucket();

  hydrateIcons();
  renderAll();
  bindEvents();
  dismissBootSplash();

  const heroPanel = document.querySelector('.lp-hero');
  if (heroPanel) addCardOutline(heroPanel, { notch: 44, ext: 78, inset: 1.5 });
  if (document.documentElement.dataset.mode === 'app') await ensurePersistence();

  if (restored) toast('Backup restored');

  if (pendingRestore) {
    const ok = await appConfirm({
      title: 'Restore from this backup link?',
      body: 'Profiles from the backup are added to this device. If a profile already exists here, whichever copy was edited more recently is kept.',
      confirmLabel: 'Restore',
    });
    if (ok) toast(restoreResultMsg(restoreFromBackup(pendingRestore)));
    clearBackupFragment();
  }

  refreshBackupNudge();

  maybeShowTermsGate();
  maybeShowInstallHint();
  maybeShowNfc();

  if (new URLSearchParams(location.search).has('present')) {
    const data = buildShareData(profile, activeBucketId);
    if (data && data.validCount > 0) togglePresent();
    else toast('This group is empty. Add a handle to it first.');
  }
}

function restoreResultMsg({ added, updated }) {
  const parts = [];
  if (added) parts.push(`${added} profile${added === 1 ? '' : 's'} added`);
  if (updated) parts.push(`${updated} updated`);
  return parts.length ? `Restored: ${parts.join(', ')}` : 'Already up to date';
}

function dismissBootSplash() {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    splash.classList.add('boot-splash-done');
    const remove = () => splash.remove();
    splash.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 600);
  }));
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function isMobile() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod|Android/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function maybeShowInstallHint() {
  const btn = document.getElementById('install-hint-btn');
  if (btn && !isStandalone() && isMobile()) btn.hidden = false;
}

// First-run agreement.
const TERMS_KEY = 'canid:termsAccepted';
const TERMS_VERSION = '2026-06-18';

function hasAcceptedTerms() {
  try { return localStorage.getItem(TERMS_KEY) === TERMS_VERSION; } catch (_) { return false; }
}

function maybeShowTermsGate() {
  if (document.documentElement.dataset.mode !== 'app') return;
  if (hasAcceptedTerms()) return;
  const gate = document.getElementById('terms-gate');
  if (!gate) return;

  const bg = ['top-bar', 'profile-bar', 'dashboard', 'bottom-nav', 'web-footer']
    .map(id => document.getElementById(id)).filter(Boolean);
  bg.forEach(el => el.setAttribute('inert', ''));

  if (isStandalone()) {
    const cancelBtn = document.getElementById('terms-gate-cancel');
    if (cancelBtn) cancelBtn.hidden = true;
  }

  gate.hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('terms-gate-dialog').focus();
  const agree = document.getElementById('terms-gate-agree');

  agree.addEventListener('click', () => {
    try { localStorage.setItem(TERMS_KEY, TERMS_VERSION); } catch (_) {}
    gate.hidden = true;
    document.body.style.overflow = '';
    bg.forEach(el => el.removeAttribute('inert'));
  });

  document.getElementById('terms-gate-cancel').addEventListener('click', () => {
    if (history.length > 1) history.back();
    else location.href = '/';
  });
}

function restoreFromBackup(decodedStore) {
  const result = restoreBackup(decodedStore);
  profile = getActiveProfile();
  setActiveBucket(profile.defaultBucketId);
  renderAll();
  refreshBackupNudge();
  return result;
}

function switchProfile(id) {
  if (id === getActiveId()) { closeProfileMenu(); return; }
  flushSave(profile);
  switchActive(id);
  profile = getActiveProfile();
  setActiveBucket(profile.defaultBucketId);
  Object.keys(copiedURLs).forEach(k => delete copiedURLs[k]);
  renderAll();
  closeProfileMenu();
  refreshBackupNudge();
  toast(`Switched to ${profile.profileName}`);
}

function renderAll() {
  applyColors();
  document.getElementById('display-name').value = profile.name || '';
  renderNetworkPicker();
  renderHandles();
  renderBucketTabs();
  renderBucketNames();
  renderDefaultBucketSelect();
  renderMatrix();
  renderFontPicker();
  renderQR();
  syncSafeModeBtn();
  renderProfileBar();
}

function renderFontPicker() {
  const picker = document.getElementById('font-picker');
  if (!picker) return;
  picker.innerHTML = '';
  const active = profile.font || 'k';
  for (const font of FONTS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'font-option';
    btn.textContent = 'canid.';
    btn.style.fontFamily = font.css;
    btn.title = font.label;
    btn.setAttribute('aria-pressed', String(font.code === active));
    btn.setAttribute('aria-label', `${font.label} font`);
    btn.addEventListener('click', () => {
      if (font.code === 'k') delete profile.font;
      else profile.font = font.code;
      renderFontPicker();
      renderQR();
      autosave();
    });
    picker.appendChild(btn);
  }
}

function syncSafeModeBtn() {
  const on = !!profile.ui.safeMode;

  const btn = document.getElementById('safe-mode-toggle');
  if (btn) {
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'On' : 'Off';
  }


  const present = document.getElementById('present-contrast-btn');
  if (present) present.setAttribute('aria-pressed', String(on));
}

// ── Profiles ───────────────────────────────────────────────────────────────

function renderProfileBar() {
  const current = document.getElementById('profile-current');
  if (!current) return;
  current.textContent = profile.profileName || 'Main';
  const swatch = document.getElementById('profile-swatch');
  if (swatch) swatch.style.background = `#${profile.scheme.p}`;
}

const PROFILE_MENU_INERT_IDS = ['top-bar', 'profile-bar', 'dashboard', 'bottom-nav', 'web-footer'];
let profileMenuLastFocus = null;

function setBackdropInert(on) {
  for (const id of PROFILE_MENU_INERT_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (on) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }
}

function openProfileMenu() {
  const menu = document.getElementById('profile-menu');
  if (!menu) return;
  renderProfileList();
  profileMenuLastFocus = document.activeElement;
  menu.hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('profile-switch').setAttribute('aria-expanded', 'true');
  setBackdropInert(true);
  const target = menu.querySelector('.profile-row.active .profile-row-main') || document.getElementById('profile-new');
  target?.focus();
}

function closeProfileMenu() {
  const menu = document.getElementById('profile-menu');
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  document.body.style.overflow = '';
  document.getElementById('profile-switch').setAttribute('aria-expanded', 'false');
  setBackdropInert(false);
  if (profileMenuLastFocus && profileMenuLastFocus.focus) profileMenuLastFocus.focus();
}

function renderProfileList() {
  const list = document.getElementById('profile-list');
  if (!list) return;
  list.innerHTML = '';
  const activeId = getActiveId();
  const profiles = listProfiles();

  for (const item of profiles) {
    const row = document.createElement('div');
    row.className = 'profile-row' + (item.id === activeId ? ' active' : '');
    row.dataset.id = item.id;

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'profile-row-main';
    main.addEventListener('click', () => switchProfile(item.id));

    const dot = document.createElement('span');
    dot.className = 'profile-swatch';
    dot.style.background = `#${item.p}`;

    const nm = document.createElement('span');
    nm.className = 'profile-row-name';
    nm.textContent = item.profileName;

    main.append(dot, nm);
    if (item.id === activeId) {
      const chk = document.createElement('span');
      chk.className = 'profile-row-check';
      chk.textContent = '✓';
      main.appendChild(chk);
    }
    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'profile-row-actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'profile-row-btn';
    edit.innerHTML = PENCIL_ICON;
    edit.setAttribute('aria-label', `Rename ${item.profileName}`);
    edit.addEventListener('click', () => startRename(row, item));
    actions.appendChild(edit);

    if (profiles.length > 1) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'profile-row-btn profile-row-del';
      del.innerHTML = TRASH_ICON;
      del.setAttribute('aria-label', `Delete ${item.profileName}`);
      del.addEventListener('click', () => removeProfile(item));
      actions.appendChild(del);
    }
    row.appendChild(actions);
    list.appendChild(row);
  }
}

function startRename(row, item) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'profile-rename-input';
  input.value = item.profileName;
  input.maxLength = 30;
  input.setAttribute('aria-label', 'Profile name');
  row.innerHTML = '';
  row.appendChild(input);
  input.focus();
  input.select();

  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    renameProfile(item.id, input.value);
    if (item.id === getActiveId()) renderProfileBar();
    renderProfileList();
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); done = true; renderProfileList(); }
  });
  input.addEventListener('blur', commit);
}

async function removeProfile(item) {
  const ok = await appConfirm({
    title: `Delete “${item.profileName}”?`,
    body: 'This removes the profile and its groups from this device. Back up first if you might want it later.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!ok) return;
  deleteProfile(item.id);
  profile = getActiveProfile();
  setActiveBucket(profile.defaultBucketId);
  renderAll();
  renderProfileList();
  refreshBackupNudge();
}

function newProfile() {
  const id = createProfile('New profile');
  flushSave(profile);
  switchActive(id);
  profile = getActiveProfile();
  setActiveBucket(profile.defaultBucketId);
  renderAll();
  renderProfileList();
  refreshBackupNudge();
  const row = document.querySelector(`.profile-row[data-id="${id}"]`);
  const item = listProfiles().find(p => p.id === id);
  if (row && item) startRename(row, item);
}

function hydrateIcons() {
  for (const el of document.querySelectorAll('[data-icon]')) {
    const markup = UI_ICONS[el.dataset.icon];
    if (markup) el.innerHTML = markup;
  }
}

// ── Color ──────────────────────────────────────────────────────────────────

function applyColors() {
  const { p, a } = profile.scheme;

  document.documentElement.style.setProperty('--theme-primary-rgb', hexToRgb(p));

  document.getElementById('color-p').value = `#${p}`;
  document.getElementById('color-a').value = `#${a}`;
  document.getElementById('swatch-p-gradient').style.background = `#${p}`;
  document.getElementById('swatch-a-gradient').style.background = `#${a}`;

  const profileSwatch = document.getElementById('profile-swatch');
  if (profileSwatch) profileSwatch.style.background = `#${p}`;
}

// ── Handles ────────────────────────────────────────────────────────────────

function getIconForKey(key) {
  // Strip numeric suffix: ig_2 → ig
  const base = key.replace(/_\d+$/, '');
  return BRAND_ICONS[base] || BRAND_ICONS['url'];
}

function renderNetworkPicker() {
  const picker = document.getElementById('network-picker');
  if (!picker) return;
  picker.innerHTML = '';

  const available = REGISTRY
    .filter(reg => sortedKeysForBase(reg.key).length === 0)
    .sort(byDisplayOrder);

  if (available.length === 0) {
    const done = document.createElement('div');
    done.className = 'network-picker-empty';
    done.textContent = 'All networks added';
    picker.appendChild(done);
    return;
  }

  for (const reg of available) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'net-tile kc-notch';
    tile.dataset.key = reg.key;
    tile.setAttribute('aria-label', `Add ${reg.label}`);

    const icon = document.createElement('span');
    icon.className = 'net-tile-icon';
    icon.innerHTML = getIconForKey(reg.key);

    const label = document.createElement('span');
    label.className = 'net-tile-label';
    label.textContent = reg.label;

    tile.appendChild(icon);
    tile.appendChild(label);
    picker.appendChild(tile);
  }
}

function renderHandles() {
  const list = document.getElementById('handles-list');
  list.innerHTML = '';

  const activePlatforms = REGISTRY
    .filter(reg => sortedKeysForBase(reg.key).length > 0)
    .sort(byDisplayOrder);

  if (activePlatforms.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'handles-empty-state';
    empty.innerHTML = `
      <span class="ui-icon">${UI_ICONS.card}</span>
      <div class="handles-empty-state-title">No networks added</div>
      <div class="handles-empty-state-desc">Choose a network from the picker below to add it to your profile.</div>
    `;
    list.appendChild(empty);
    return;
  }

  for (const reg of activePlatforms) {
    const group = document.createElement('div');
    group.className = 'handle-group';
    group.dataset.base = reg.key;

    const labelEl = document.createElement('span');
    labelEl.className = 'handle-platform-label';
    labelEl.textContent = reg.label;
    group.appendChild(labelEl);

    const rowsEl = document.createElement('div');
    rowsEl.className = 'handle-rows';

    const keys = sortedKeysForBase(reg.key);
    for (const key of keys) {
      rowsEl.appendChild(makeHandleRow(key, reg));
    }

    group.appendChild(rowsEl);

    const addBtn = document.createElement('button');
    addBtn.className = 'add-handle-btn';
    addBtn.dataset.base = reg.key;
    addBtn.textContent = `+ Add another ${reg.label}`;
    group.appendChild(addBtn);

    list.appendChild(group);
  }
}

function canLabel(reg) {
  return reg.urlType || reg.idType || reg.mapType || reg.endpoint === 'mailto:' || reg.endpoint === 'tel:';
}

function isVerbatim(reg) {
  return reg.mapType || reg.endpoint === 'mailto:' || reg.endpoint === 'tel:';
}

function makeHandleRow(key, reg) {
  const row = document.createElement('div');
  row.className = 'handle-row kc-notch';

  // Icon box
  const iconBox = document.createElement('div');
  iconBox.className = 'handle-icon-box';
  iconBox.innerHTML = getIconForKey(key);
  row.appendChild(iconBox);

  // Stacked field column: optional label on top, the handle/URL below.
  const fields = document.createElement('div');
  fields.className = 'handle-fields';

  if (canLabel(reg)) {
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'handle-label-input';
    labelInput.dataset.key = key;
    labelInput.value = (profile.labels && profile.labels[key]) || '';
    labelInput.placeholder = (reg.host || reg.idType) ? 'Handle, e.g. @yourname'
      : reg.urlType ? 'Label, e.g. My website'
      : reg.mapType ? 'Label, e.g. Home'
      : reg.endpoint === 'tel:' ? 'Label, e.g. Mobile'
      : 'Label, e.g. Work email';
    labelInput.maxLength = 40;
    labelInput.autocomplete = 'off';
    labelInput.spellcheck = false;
    fields.appendChild(labelInput);
  }

  // Input
  const input = document.createElement('input');
  input.type = reg.urlType ? 'url'
    : reg.endpoint === 'mailto:' ? 'email'
    : reg.endpoint === 'tel:' ? 'tel'
    : 'text';
  input.id = `h_${key}`;
  input.className = 'handle-input';
  input.dataset.key = key;

  let val = profile.handles[key] || '';
  if (val && !reg.urlType && !isVerbatim(reg)) {
    val = sanitizeHandle(reg, val);
    if (val !== profile.handles[key]) profile.handles[key] = val;
  }

  input.value = val;
  input.placeholder = reg.placeholder ? reg.placeholder
    : reg.idType ? `${reg.label} link or ID`
    : reg.host ? `Paste your ${reg.label} profile URL`
    : reg.urlType ? 'https://…'
    : reg.mapType ? 'Address or coordinates'
    : reg.endpoint === 'mailto:' ? 'Email address'
    : reg.endpoint === 'tel:' ? 'Phone number'
    : `${reg.label} handle`;
  input.autocomplete = 'off';
  input.autocapitalize = reg.mapType ? 'words' : 'none';
  input.spellcheck = false;
  if (reg.digits) input.inputMode = 'numeric';

  fields.appendChild(input);

  // Wrapping guidance for non-obvious inputs
  if (reg.hint) {
    const hint = document.createElement('p');
    hint.className = 'handle-hint';
    hint.textContent = reg.hint;
    fields.appendChild(hint);
  }

  row.appendChild(fields);

  // Remove button for all rows
  const btn = document.createElement('button');
  btn.className = 'remove-handle-btn';
  btn.dataset.key = key;
  btn.setAttribute('aria-label', `Remove this handle`);
  btn.textContent = '−';
  row.appendChild(btn);

  if (profile.handles[key] && !isValidHandle(reg, profile.handles[key])) {
    row.classList.add('invalid');
  }

  return row;
}
function sanitizeHandle(reg, val) {
  if (reg.suffix) {
    if (val.includes('.') || val.includes('/')) {
      try {
        const u = new URL(val.startsWith('http') ? val : `https://${val}`);
        val = u.hostname.split('.')[0] || val;
      } catch (_) {}
    }
    return val.toLowerCase().replace(/[^a-z0-9-]/g, '');
  }
  if (reg.pathLabel) {
    const host = new URL(reg.endpoint).hostname;
    const low = val.toLowerCase();
    if (/^https?:\/\//i.test(val) || low.startsWith(host + '/') || low.startsWith('www.' + host + '/')) {
      try {
        const u = new URL(val.startsWith('http') ? val : `https://${val}`);
        val = u.pathname.split('/').filter(Boolean).slice(0, 2).join('/');
      } catch (_) {}
    }
    return val.replace(/[^A-Za-z0-9._~/-]/g, '');
  }
  if (val.includes('/')) {
    try {
      const u = new URL(val.startsWith('http') ? val : `https://${val}`);
      // Skip 'ref=…'-style path segments
      val = u.pathname.split('/').filter(s => s && !s.includes('=')).pop() || val;
    } catch (_) {}
  }
  if (reg.digits) return val.replace(/[^0-9]/g, '');
  return val.replace(/[^A-Za-z0-9._~-]/g, '');
}

// A handle is valid if a URL-type value parses as https, or a username
// matches its platform's allowlist regex. Shared with the link builder.
function isValidHandle(reg, val) {
  return isValidValue(reg, val);
}

function sortedKeysForBase(base) {
  return Object.keys(profile.handles)
    .filter(k => k === base || k.startsWith(base + '_'))
    .sort((a, b) => {
      const na = parseInt(a.split('_').pop()) || 0;
      const nb = parseInt(b.split('_').pop()) || 0;
      return na - nb;
    });
}

function nextKey(base) {
  const existing = sortedKeysForBase(base);
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

function addHandle(base) {
  const key = nextKey(base);
  profile.handles[key] = '';
  return key;
}

// ── Buckets ────────────────────────────────────────────────────────────────

function renderBucketTabs() {
  const tabs = document.getElementById('bucket-tabs');
  tabs.innerHTML = '';
  for (const bucket of profile.buckets) {
    const btn = document.createElement('button');
    btn.className = 'bucket-tab' + (bucket.id === activeBucketId ? ' active' : '');
    btn.dataset.bucketId = bucket.id;
    btn.title = bucket.name || 'Untitled';
    const tabLabel = document.createElement('span');
    tabLabel.className = 'bucket-tab-label';
    tabLabel.textContent = bucket.name || 'Untitled';
    btn.appendChild(tabLabel);
    btn.setAttribute('aria-pressed', String(bucket.id === activeBucketId));
    tabs.appendChild(btn);
  }
}

function renderDefaultBucketSelect() {
  const sel = document.getElementById('default-bucket-select');
  sel.innerHTML = '';
  for (const bucket of profile.buckets) {
    const opt = document.createElement('option');
    opt.value = bucket.id;
    opt.textContent = bucket.name || 'Untitled';
    opt.selected = bucket.id === profile.defaultBucketId;
    sel.appendChild(opt);
  }
}

function bucketNamePlaceholder() {
  return profile.name ? profile.name : 'canid logo';
}

function updateBucketNamePlaceholders() {
  const ph = bucketNamePlaceholder();
  for (const i of document.querySelectorAll('#bucket-names .bucket-dn-input')) i.placeholder = ph;
}

function renderBucketNames() {
  const namesEl = document.getElementById('bucket-names');
  namesEl.innerHTML = '';
  for (const bucket of profile.buckets) {
    const block = document.createElement('div');
    block.className = 'bucket-name-block';

    // Group name (the tab label).
    const nameLabel = document.createElement('label');
    nameLabel.className = 'bucket-field';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = 'Group';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'bucket-name-input';
    nameInput.value = bucket.name;
    nameInput.maxLength = 30;
    nameInput.dataset.bucketId = bucket.id;
    nameInput.setAttribute('aria-label', `Rename ${bucket.name} group`);
    nameLabel.append(nameSpan, nameInput);

    const nameRow = document.createElement('div');
    nameRow.className = 'bucket-name-row';
    nameRow.appendChild(nameLabel);

    if (profile.buckets.length > 1) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'bucket-remove-btn';
      del.dataset.bucketId = bucket.id;
      del.innerHTML = TRASH_ICON;
      del.setAttribute('aria-label', `Delete ${bucket.name} group`);
      nameRow.appendChild(del);
    }

    const dnLabel = document.createElement('label');
    dnLabel.className = 'bucket-field';
    const dnSpan = document.createElement('span');
    dnSpan.textContent = 'Display';
    const dnInput = document.createElement('input');
    dnInput.type = 'text';
    dnInput.className = 'bucket-dn-input';
    dnInput.value = bucket.displayName || '';
    dnInput.dataset.bucketId = bucket.id;
    dnInput.maxLength = 40;
    dnInput.autocomplete = 'off';
    dnInput.autocapitalize = 'none';
    dnInput.spellcheck = false;
    dnInput.placeholder = bucketNamePlaceholder();
    dnInput.setAttribute('aria-label', `Name shown on the ${bucket.name} card`);
    dnLabel.append(dnSpan, dnInput);

    block.append(nameRow, dnLabel);
    namesEl.appendChild(block);
  }

  const addBtn = document.getElementById('add-bucket-btn');
  if (addBtn) addBtn.hidden = profile.buckets.length >= MAX_BUCKETS;
}

// ── Add / remove groups ──────────────────────────────────────────────────────

const MAX_BUCKETS = 5;

function genBucketId() {
  let id;
  do { id = 'b_' + Math.random().toString(36).slice(2, 8); }
  while (profile.buckets.some(b => b.id === id));
  return id;
}

function addBucket() {
  if (profile.buckets.length >= MAX_BUCKETS) return;
  profile.buckets.push({ id: genBucketId(), name: 'New group', members: [] });
  renderAll();
  autosave();
  const inputs = document.querySelectorAll('#bucket-names .bucket-name-input');
  const last = inputs[inputs.length - 1];
  if (last) { last.focus(); last.select(); }
}

async function removeBucket(bucketId) {
  const bucket = profile.buckets.find(b => b.id === bucketId);
  if (!bucket || profile.buckets.length <= 1) return;
  const ok = await appConfirm({
    title: `Delete “${bucket.name || 'this group'}”?`,
    body: 'This removes the group from this profile. Your handles stay in the list, and links you already shared keep working.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!ok) return;
  profile.buckets = profile.buckets.filter(b => b.id !== bucketId);
  if (profile.defaultBucketId === bucketId) profile.defaultBucketId = profile.buckets[0].id;
  if (activeBucketId === bucketId) setActiveBucket(profile.defaultBucketId);
  renderAll();
  autosave();
}

// ── Membership matrix ──────────────────────────────────────────────────────

function renderMatrix() {
  const container = document.getElementById('membership-matrix');
  container.innerHTML = '';

  const activeKeys = Object.entries(profile.handles)
    .filter(([, v]) => v && v.trim())
    .map(([k]) => k);

  container.classList.toggle('matrix-empty', activeKeys.length === 0);
  if (activeKeys.length === 0) {
    container.textContent = 'Add handles above to assign them to groups.';
    return;
  }

  // Deduplicate to unique base platforms that have active keys
  const platformsWithKeys = [];
  for (const reg of [...REGISTRY].sort(byDisplayOrder)) {
    const keys = activeKeys.filter(k => k === reg.key || k.startsWith(reg.key + '_'));
    for (const key of keys) {
      platformsWithKeys.push({ reg, key });
    }
  }

  const table = document.createElement('table');
  table.className = 'matrix-table';

  // Header
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  el(hr, 'th', '');
  for (const bucket of profile.buckets) {
    const th = el(hr, 'th', '');
    th.title = bucket.name || 'Untitled';
    const colName = document.createElement('span');
    colName.className = 'matrix-col-name';
    colName.textContent = bucket.name || 'Untitled';
    th.appendChild(colName);
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  // Rows
  const tbody = document.createElement('tbody');
  for (const { reg, key } of platformsWithKeys) {
    const tr = document.createElement('tr');
    const suffix = key.replace(reg.key, '').replace(/^_/, '');
    const handleVal = (profile.handles[key] || '').trim();
    const customLabel = profile.labels && profile.labels[key];
    const labelText = customLabel || handleVal || (suffix ? `${reg.label} (${suffix})` : reg.label);

    // Label cell with icon
    const td0 = document.createElement('td');
    const labelWrap = document.createElement('div');
    labelWrap.className = 'matrix-label';
    const iconSpan = document.createElement('span');
    iconSpan.innerHTML = getIconForKey(key);
    labelWrap.appendChild(iconSpan);
    const textSpan = document.createElement('span');
    textSpan.textContent = labelText;
    labelWrap.appendChild(textSpan);
    td0.appendChild(labelWrap);
    tr.appendChild(td0);

    for (const bucket of profile.buckets) {
      const td = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'matrix-cb';
      cb.checked = bucket.members.includes(key);
      cb.dataset.bucketId = bucket.id;
      cb.dataset.key = key;
      cb.setAttribute('aria-label', `${labelText} in ${bucket.name}`);
      td.appendChild(cb);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

// ── QR ────────────────────────────────────────────────────────────────────

function renderQR() {
  if (document.documentElement.dataset.mode === 'landing') return;
  const data = buildShareData(profile, activeBucketId);
  if (!data) return;

  const { url, validCount, hasInvalid } = data;

  const warningEl = document.getElementById('qr-warning');
  const actionBtns = document.querySelectorAll('.qr-action-btn, .bottom-nav-btn');

  document.querySelector('.qr-outer')?.classList.toggle('qr-empty', validCount === 0);

  if (warningEl) {
    const emptyProfile = !Object.values(profile.handles).some(v => v && v.trim());
    warningEl.classList.toggle('neutral', validCount === 0 && emptyProfile);
    if (validCount === 0) {
      warningEl.hidden = false;
      warningEl.innerHTML = emptyProfile
        ? `<span class="ui-icon">${UI_ICONS.info}</span><span>Add a handle below and your QR code will appear here.</span>`
        : `<span class="ui-icon">${UI_ICONS.error}</span><span>This group is empty. Add a handle to it first.</span>`;
      actionBtns.forEach(b => { b.classList.add('disabled'); b.setAttribute('aria-disabled', 'true'); });
    } else if (hasInvalid) {
      warningEl.hidden = false;
      warningEl.innerHTML = `<span class="ui-icon">${UI_ICONS.warning}</span><span>Some handles are invalid and won’t be shared.</span>`;
      actionBtns.forEach(b => { b.classList.remove('disabled'); b.removeAttribute('aria-disabled'); });
    } else {
      warningEl.hidden = true;
      actionBtns.forEach(b => { b.classList.remove('disabled'); b.removeAttribute('aria-disabled'); });
    }
  }

  const preview = document.getElementById('preview-link');
  if (preview) {
    if (validCount > 0) { preview.href = url; preview.hidden = false; }
    else preview.hidden = true;
  }

  updateLengthHint(data);
  updateCopyButtonState();

  buildQR(url, document.getElementById('qr-container'), {
    primary: profile.scheme.p,
    accent:  profile.scheme.a,
    safeMode: profile.ui.safeMode,
  });
}

// ── Length hint ──────────────────────────────────────────────────────────────
function updateLengthHint(data) {
  const hint = document.getElementById('qr-length-hint');
  if (!hint) return;
  const level = data && data.validCount > 0 ? lengthLevel(data.length) : 0;
  if (level === 0) { hint.hidden = true; return; }
  hint.hidden = false;
  hint.classList.toggle('severe', level === 2);
  hint.textContent = level === 2
    ? 'Long link: this QR is dense and may be hard to scan. Try splitting handles across groups, or use shorter custom links.'
    : 'Heads up: this link is getting long, which makes the QR denser.';
}

// ── Share / copy button state ────────────────────────────────────────────────
const CAN_SHARE = typeof navigator !== 'undefined'
  && typeof navigator.share === 'function'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(pointer: coarse)').matches;

function shareTitle() {
  const bucket = profile.buckets.find(b => b.id === activeBucketId);
  const name = (bucket && bucket.displayName) || profile.name;
  return name ? `${name} — canid card` : 'My canid card';
}

function copyState() {
  const data = buildShareData(profile, activeBucketId);
  const current = data ? data.url : '';
  const copied = copiedURLs[activeBucketId];
  if (copied && copied === current) return { state: 'copied', current };
  if (copied && copied !== current) return { state: 'updated', current };
  return { state: 'fresh', current };
}

function updateCopyButtonState() {
  const { state } = copyState();
  const spec = (CAN_SHARE ? {
    fresh:   { icon: 'share', text: 'Share',        nav: 'Share' },
    copied:  { icon: 'check', text: 'Shared',       nav: 'Shared' },
    updated: { icon: 'share', text: 'Share update', nav: 'Share update' },
  } : {
    fresh:   { icon: 'link',    text: 'Copy link',         nav: 'Copy link' },
    copied:  { icon: 'check',   text: 'Link copied',       nav: 'Copied' },
    updated: { icon: 'restore', text: 'Copy updated link', nav: 'Copy update' },
  })[state];

  const btn = document.getElementById('copy-btn');
  if (btn) {
    btn.classList.toggle('is-copied', state === 'copied');
    btn.classList.toggle('needs-recopy', state === 'updated');
    btn.title = spec.text;
    const ic = btn.querySelector('.ui-icon');
    if (ic) ic.innerHTML = UI_ICONS[spec.icon];
    const label = btn.querySelector('span:last-child');
    if (label) label.textContent = spec.text;
  }

  const nav = document.getElementById('nav-copy-btn');
  if (nav) {
    nav.classList.toggle('is-copied', state === 'copied');
    nav.classList.toggle('needs-recopy', state === 'updated');
    nav.setAttribute('aria-label', spec.nav);
    const ic = nav.querySelector('.ui-icon');
    if (ic) ic.innerHTML = UI_ICONS[spec.icon];
    const label = nav.querySelector('.nav-label');
    if (label) label.textContent = spec.nav;
  }
}

async function copyShareLink(e) {
  if (e && e.currentTarget && e.currentTarget.classList.contains('disabled')) {
    toast('This group is empty. Add a handle to it first.');
    return;
  }

  const wasUpdated = copyState().state === 'updated';
  const data = buildShareData(profile, activeBucketId);
  if (!data || data.validCount === 0) {
    toast('This group is empty. Add a handle to it first.');
    return;
  }

  if (data.hasInvalid) toast('Warning: Invalid handles excluded from link');

  let ok;
  if (CAN_SHARE) {
    try {
      await navigator.share({ url: data.url, title: shareTitle() });
      ok = true;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      ok = await copyText(data.url, wasUpdated ? 'Updated link copied!' : 'Link copied to clipboard!');
    }
  } else {
    ok = await copyText(data.url, wasUpdated ? 'Updated link copied!' : 'Link copied to clipboard!');
  }

  if (ok) {
    copiedURLs[activeBucketId] = data.url;
    updateCopyButtonState();
  }
}

async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
    return true;
  } catch (_) {
    window.prompt('Copy this link:', text);
    return false;
  }
}

// ── Backup ─────────────────────────────────────────────────────────────────

let _backupFragment = '';

function showBackup() {
  _backupFragment = encodeAllBackup();
  const url = `${location.origin}/#b=${_backupFragment}`;

  const output = document.getElementById('backup-output');
  const display = document.getElementById('backup-url-display');
  backupRevealed = false;
  display.dataset.url = url;
  display.textContent = '•'.repeat(60);
  display.classList.add('masked');
  document.getElementById('reveal-backup-btn').textContent = 'Reveal';
  output.hidden = false;
}

function toggleReveal() {
  const display = document.getElementById('backup-url-display');
  backupRevealed = !backupRevealed;
  if (backupRevealed) {
    _backupFragment = encodeAllBackup();
    const url = `${location.origin}/#b=${_backupFragment}`;
    display.dataset.url = url;
    display.textContent = url;
  } else {
    display.textContent = '•'.repeat(60);
  }
  display.classList.toggle('masked', !backupRevealed);
  document.getElementById('reveal-backup-btn').textContent = backupRevealed ? 'Hide' : 'Reveal';
}

async function copyBackup() {
  _backupFragment = encodeAllBackup();
  const url = `${location.origin}/#b=${_backupFragment}`;
  const display = document.getElementById('backup-url-display');
  display.dataset.url = url;
  await copyText(url, 'Copied. Paste into a password manager');
  markBackedUp();
  refreshBackupNudge();
}

function downloadBackup() {
  const blob = new Blob([backupJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'canid-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
  markBackedUp();
  refreshBackupNudge();
}

// ── Wake lock / present ───────────────────────────────────────────────────

async function requestWakeLock() {
  if (!navigator.wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wantWakeLock = true;
  } catch (_) {}
}

function releaseWakeLock() {
  wantWakeLock = false;
  wakeLock?.release();
  wakeLock = null;
}

function openPresent() {
  document.body.classList.add('present');
  const section = document.getElementById('qr-section');
  const activeBucket = profile.buckets.find(b => b.id === activeBucketId);
  document.getElementById('present-name').textContent =
    (activeBucket && activeBucket.displayName) || profile.name || '';
  section.setAttribute('role', 'dialog');
  section.setAttribute('aria-modal', 'true');
  setPresentInert(true);
  requestWakeLock();
  document.getElementById('exit-present-btn').focus();
  history.pushState({ present: true }, '');
}

function closePresent() {
  if (!document.body.classList.contains('present')) return;
  document.body.classList.remove('present');
  const section = document.getElementById('qr-section');
  section.removeAttribute('role');
  section.removeAttribute('aria-modal');
  document.getElementById('present-name').textContent = '';
  setPresentInert(false);
  releaseWakeLock();
  document.getElementById('present-btn')?.focus();
}

function togglePresent(e) {
  if (e && e.currentTarget && e.currentTarget.classList.contains('disabled')) {
    toast('This group is empty. Add a handle to it first.');
    return;
  }
  if (document.body.classList.contains('present')) {
    history.back();
  } else {
    openPresent();
  }
}

window.addEventListener('popstate', () => {
  if (document.body.classList.contains('present')) closePresent();
});

const PRESENT_INERT_IDS = [
  'top-bar', 'profile-bar', 'bottom-nav', 'web-footer', 'control-bar', 'name-section',
  'color-section', 'handles-section', 'matrix-section', 'bucket-config',
  'backup-section',
];
function setPresentInert(on) {
  for (const id of PRESENT_INERT_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (on) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }
}

document.addEventListener('visibilitychange', async () => {
  if (wantWakeLock && document.visibilityState === 'visible') {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
  }
});

async function saveQR() {
  toast('Saving QR…');
  try {
    const ok = await downloadQR();
    toast(ok ? 'QR saved' : "Couldn’t save the QR");
  } catch (_) {
    toast("Couldn’t save the QR");
  }
}

// ── In-app confirm dialog ─────────────────────────

let _confirmResolve = null;
let _confirmLastFocus = null;
let _confirmInerted = [];

function appConfirm({ title, body, confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false }) {
  const modal = document.getElementById('confirm-modal');
  if (!modal) return Promise.resolve(window.confirm(`${title}\n\n${body}`));
  if (!modal.hidden) settleConfirm(false);

  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-body').textContent = body;
    const okBtn = document.getElementById('confirm-ok');
    okBtn.textContent = confirmLabel;
    okBtn.classList.toggle('danger', danger);
    document.getElementById('confirm-cancel').textContent = cancelLabel;

    _confirmInerted = [];
    for (const id of [...PROFILE_MENU_INERT_IDS, 'profile-menu']) {
      const el = document.getElementById(id);
      if (el && !el.hasAttribute('inert')) {
        el.setAttribute('inert', '');
        _confirmInerted.push(el);
      }
    }

    _confirmLastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    (danger ? document.getElementById('confirm-cancel') : okBtn).focus();
  });
}

function settleConfirm(result) {
  const modal = document.getElementById('confirm-modal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  const menuOpen = document.getElementById('profile-menu')?.hidden === false;
  if (!menuOpen) document.body.style.overflow = '';
  for (const el of _confirmInerted) el.removeAttribute('inert');
  _confirmInerted = [];
  if (_confirmLastFocus && _confirmLastFocus.focus) _confirmLastFocus.focus();
  const resolve = _confirmResolve;
  _confirmResolve = null;
  if (resolve) resolve(result);
}

// ── Events ─────────────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('handles-list').addEventListener('input', e => {
    const labelInput = e.target.closest('.handle-label-input');
    if (labelInput) {
      const v = labelInput.value.slice(0, 40);
      if (!profile.labels) profile.labels = {};
      if (v.trim()) profile.labels[labelInput.dataset.key] = v;
      else delete profile.labels[labelInput.dataset.key];
      renderMatrix();
      renderQR();
      autosave();
      return;
    }

    const input = e.target.closest('.handle-input');
    if (!input) return;

    let val = input.value;
    const base = input.dataset.key.replace(/_\d+$/, '');
    const reg = REGISTRY.find(r => r.key === base);

    // Sanitize usernames
    if (reg && !reg.urlType && !isVerbatim(reg)) {
      const cleaned = sanitizeHandle(reg, val);
      if (cleaned !== val) {
        input.value = cleaned;
        val = cleaned;
      }
    }

    if (reg && reg.urlType) {
      if (/^http:\/\//i.test(val)) {
        val = val.replace(/^http:\/\//i, 'https://');
        input.value = val;
      }
    }

    const row = input.closest('.handle-row');
    row.classList.toggle('invalid', !!val && reg && !isValidHandle(reg, val));

    profile.handles[input.dataset.key] = val;
    renderMatrix();
    renderQR();
    autosave();
  });

  document.getElementById('handles-list').addEventListener('change', e => {
    const input = e.target.closest('.handle-input');
    if (!input) return;
    const base = input.dataset.key.replace(/_\d+$/, '');
    const reg = REGISTRY.find(r => r.key === base);
    if (!reg || !reg.urlType) return;

    let val = input.value.trim();
    if (!val) return;

    if (/^http:\/\//i.test(val)) {
      val = val.replace(/^http:\/\//i, 'https://');
      input.value = val;
    } else if (/^[a-z][a-z0-9+.\-]*:\/\//i.test(val)) {
      return; // already has a scheme
    } else {
      val = `https://${val}`;
      input.value = val;
    }
    profile.handles[input.dataset.key] = val;
    input.closest('.handle-row').classList.toggle('invalid', !isValidHandle(reg, val));
    renderMatrix();
    renderQR();
    autosave();
  });

  // Add / remove account buttons
  document.getElementById('handles-list').addEventListener('click', e => {
    const addBtn = e.target.closest('.add-handle-btn');
    if (addBtn) {
      const key = addHandle(addBtn.dataset.base);
      renderHandles();
      renderMatrix();
      document.getElementById(`h_${key}`)?.focus();
      autosave();
      return;
    }
    const removeBtn = e.target.closest('.remove-handle-btn');
    if (removeBtn) {
      const key = removeBtn.dataset.key;
      delete profile.handles[key];
      if (profile.labels) delete profile.labels[key];
      for (const b of profile.buckets) b.members = b.members.filter(m => m !== key);
      renderHandles();
      renderNetworkPicker();
      renderMatrix();
      renderQR();
      autosave();
    }
  });

  // Network picker
  document.getElementById('network-picker').addEventListener('click', e => {
    const tile = e.target.closest('.net-tile');
    if (!tile) return;

    const key = addHandle(tile.dataset.key);

    renderHandles();
    renderNetworkPicker();
    renderMatrix();
    renderQR();
    autosave();

    document.getElementById(`h_${key}`)?.focus();
  });

  // Bucket tabs
  document.getElementById('bucket-tabs').addEventListener('click', e => {
    const tab = e.target.closest('.bucket-tab');
    if (!tab) return;
    setActiveBucket(tab.dataset.bucketId);
    renderBucketTabs();
    renderQR();
  });

  // Add / delete groups
  document.getElementById('add-bucket-btn')?.addEventListener('click', addBucket);
  document.getElementById('bucket-names').addEventListener('click', e => {
    const del = e.target.closest('.bucket-remove-btn');
    if (del) removeBucket(del.dataset.bucketId);
  });

  // Bucket rename + per-group display name
  document.getElementById('bucket-names').addEventListener('input', e => {
    const nameInput = e.target.closest('.bucket-name-input');
    if (nameInput) {
      const bucket = profile.buckets.find(b => b.id === nameInput.dataset.bucketId);
      if (bucket) {
        bucket.name = nameInput.value;
        renderBucketTabs();
        renderDefaultBucketSelect();
        renderMatrix();
        autosave();
      }
      return;
    }

    const dnInput = e.target.closest('.bucket-dn-input');
    if (dnInput) {
      const bucket = profile.buckets.find(b => b.id === dnInput.dataset.bucketId);
      if (bucket) {
        if (dnInput.value.trim()) bucket.displayName = sanitizeText(dnInput.value);
        else delete bucket.displayName;
        renderQR();
        autosave();
      }
    }
  });

  // Default bucket select
  document.getElementById('default-bucket-select').addEventListener('change', e => {
    profile.defaultBucketId = e.target.value;
    autosave();
  });

  // Color pickers
  document.getElementById('color-p').addEventListener('input', e => {
    profile.scheme.p = e.target.value.slice(1);
    applyColors();
    renderQR();
    autosave();
  });
  document.getElementById('color-a').addEventListener('input', e => {
    profile.scheme.a = e.target.value.slice(1);
    applyColors();
    renderQR();
    autosave();
  });
  document.getElementById('swatch-p-wrap').addEventListener('click', () => {
    document.getElementById('color-p').click();
  });
  document.getElementById('swatch-a-wrap').addEventListener('click', () => {
    document.getElementById('color-a').click();
  });

  // Display name
  document.getElementById('display-name').addEventListener('input', e => {
    profile.name = sanitizeText(e.target.value);
    updateBucketNamePlaceholders();
    renderQR();
    autosave();
  });

  // Membership matrix
  document.getElementById('membership-matrix').addEventListener('change', e => {
    const cb = e.target.closest('.matrix-cb');
    if (!cb) return;
    const bucket = profile.buckets.find(b => b.id === cb.dataset.bucketId);
    if (!bucket) return;
    if (cb.checked) {
      if (!bucket.members.includes(cb.dataset.key)) bucket.members.push(cb.dataset.key);
    } else {
      bucket.members = bucket.members.filter(m => m !== cb.dataset.key);
    }
    renderQR();
    autosave();
  });

  document.getElementById('safe-mode-toggle').addEventListener('click', () => {
    profile.ui.safeMode = !profile.ui.safeMode;
    syncSafeModeBtn();
    renderQR();
    autosave();
  });

  document.getElementById('copy-btn').addEventListener('click', copyShareLink);
  document.getElementById('present-btn').addEventListener('click', togglePresent);
  document.getElementById('exit-present-btn').addEventListener('click', togglePresent);

  document.getElementById('save-qr-btn')?.addEventListener('click', saveQR);

  document.getElementById('present-contrast-btn').addEventListener('click', () => {
    profile.ui.safeMode = !profile.ui.safeMode;
    syncSafeModeBtn();
    renderQR();
    autosave();
  });

  document.getElementById('nav-present-btn').addEventListener('click', togglePresent);
  document.getElementById('nav-copy-btn').addEventListener('click', copyShareLink);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('present')) togglePresent();
  });

  document.getElementById('backup-btn').addEventListener('click', showBackup);
  document.getElementById('reveal-backup-btn').addEventListener('click', toggleReveal);
  document.getElementById('copy-backup-btn').addEventListener('click', copyBackup);
  document.getElementById('download-backup-btn').addEventListener('click', downloadBackup);

  document.getElementById('import-btn').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      let next;
      try { next = decodeBackupInput(ev.target.result); }
      catch (_) { toast("That file isn’t a valid canid backup"); return; }
      toast(restoreResultMsg(restoreFromBackup(next)));
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('restore-paste-btn').addEventListener('click', () => {
    const field = document.getElementById('backup-paste');
    const text = field.value.trim();
    if (!text) return;
    let next;
    try { next = decodeBackupInput(text); }
    catch (_) { toast("That doesn’t look like a canid backup or card link"); return; }
    field.value = '';
    toast(restoreResultMsg(restoreFromBackup(next)));
  });

  document.getElementById('nudge-backup-btn').addEventListener('click', () => {
    showBackup();
    document.getElementById('backup-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // FAQ / info modal
  document.getElementById('info-btn')?.addEventListener('click', openFAQ);
  document.getElementById('faq-close')?.addEventListener('click', closeFAQ);
  document.getElementById('faq-modal')?.addEventListener('click', e => {
    if (e.target.id === 'faq-modal') closeFAQ();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('faq-modal')?.hidden) closeFAQ();
  });

  document.getElementById('install-hint-btn')?.addEventListener('click', openInstall);
  document.getElementById('install-close')?.addEventListener('click', closeInstall);
  document.getElementById('install-modal')?.addEventListener('click', e => {
    if (e.target.id === 'install-modal') closeInstall();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('install-modal')?.hidden) closeInstall();
  });

  document.getElementById('nfc-btn')?.addEventListener('click', openNfc);
  document.getElementById('nfc-close')?.addEventListener('click', closeNfc);
  document.getElementById('nfc-write')?.addEventListener('click', writeNfc);
  document.getElementById('nfc-modal')?.addEventListener('click', e => {
    if (e.target.id === 'nfc-modal') closeNfc();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('nfc-modal')?.hidden) closeNfc();
  });

  document.getElementById('profile-switch')?.addEventListener('click', openProfileMenu);
  document.getElementById('profile-new')?.addEventListener('click', newProfile);
  document.getElementById('profile-menu')?.addEventListener('click', e => {
    if (e.target.id === 'profile-menu') closeProfileMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || document.getElementById('profile-menu')?.hidden) return;
    if (document.getElementById('confirm-modal')?.hidden === false) return;
    closeProfileMenu();
  });

  document.getElementById('confirm-ok')?.addEventListener('click', () => settleConfirm(true));
  document.getElementById('confirm-cancel')?.addEventListener('click', () => settleConfirm(false));
  document.getElementById('confirm-modal')?.addEventListener('click', e => {
    if (e.target.id === 'confirm-modal') settleConfirm(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('confirm-modal')?.hidden === false) {
      settleConfirm(false);
    }
  });

  window.addEventListener('pagehide', () => flushSave(profile));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave(profile);
  });
}

// ── FAQ modal ────────────────────────────────────────────────────────────────

let _faqBuilt = false;
let _faqLastFocus = null;

function openFAQ() {
  const modal = document.getElementById('faq-modal');
  if (!modal) return;
  if (!_faqBuilt) {
    renderFAQ(document.getElementById('faq-body'));
    _faqBuilt = true;
  }
  _faqLastFocus = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  setBackdropInert(true);
  document.getElementById('faq-close')?.focus();
}

function closeFAQ() {
  const modal = document.getElementById('faq-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  setBackdropInert(false);
  if (_faqLastFocus && _faqLastFocus.focus) _faqLastFocus.focus();
}

let _installLastFocus = null;

function selectInstallPlatform(modal) {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const want = isIOS ? 'ios'
    : /SamsungBrowser/.test(ua) ? 'android-samsung'
    : /Android/.test(ua) ? 'android-chrome'
    : null;

  const items = modal.querySelectorAll('.faq-body details[data-platform]');
  if (!items.length) return;
  let matched = false;
  for (const d of items) {
    d.open = d.dataset.platform === want;
    if (d.open) matched = true;
  }
  if (!matched) items[0].open = true;
}

function openInstall() {
  const modal = document.getElementById('install-modal');
  if (!modal) return;
  selectInstallPlatform(modal);
  _installLastFocus = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  setBackdropInert(true);
  document.getElementById('install-close')?.focus();
}

function closeInstall() {
  const modal = document.getElementById('install-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  setBackdropInert(false);
  if (_installLastFocus && _installLastFocus.focus) _installLastFocus.focus();
}

// ── Write to NFC tag (Web NFC; Chrome on Android only) ───────────────────────
const NFC_SUPPORTED = 'NDEFReader' in window;
let _nfcAbort = null;
let _nfcLastFocus = null;

function maybeShowNfc() {
  if (!NFC_SUPPORTED) return;
  const btn = document.getElementById('nfc-btn');
  if (btn) btn.hidden = false;
}

function nfcTagAdvice(len) {
  if (len <= 120) return null;
  if (len <= 460) return 'This link is a little long for a standard NTAG213 tag. It should fit an NTAG215 or larger.';
  return 'This is a long link. It should fit a high-capacity tag like an NTAG216.';
}

function nfcErrorMessage(err) {
  switch (err && err.name) {
    case 'AbortError':
      return 'No tag detected. Tap "Try again" and hold the top of your phone steady against the tag.';
    case 'NotAllowedError':
      return 'NFC access was blocked. Turn on NFC in your phone settings and allow it for this site, then try again.';
    case 'NotSupportedError':
      return 'NFC isn’t available here. Writing tags needs Chrome on Android with NFC switched on.';
    case 'NetworkError':
      return 'Couldn’t write to that tag. It may be full or read-only. Try a blank, higher-capacity tag.';
    default:
      return 'Couldn’t write to the tag. It may be full, locked, or incompatible. Try a blank, higher-capacity tag.';
  }
}

function setNfcState(state) {
  const modal = document.getElementById('nfc-modal');
  if (modal) modal.dataset.state = state;
}

function openNfc() {
  const modal = document.getElementById('nfc-modal');
  if (!modal) return;

  const data = buildShareData(profile, activeBucketId);
  const statusEl = document.getElementById('nfc-status');
  const warnEl = document.getElementById('nfc-warn');
  const writeBtn = document.getElementById('nfc-write');

  if (!data || data.validCount === 0) {
    statusEl.textContent = 'This group has no valid handles yet. Add one, then you can write it to a tag.';
    warnEl.hidden = true;
    writeBtn.hidden = true;
  } else {
    const bucket = profile.buckets.find(b => b.id === activeBucketId);
    const groupName = bucket && bucket.name ? bucket.name : 'this group';
    statusEl.textContent = `You’re writing “${groupName}” to this tag.`;
    writeBtn.hidden = false;
    writeBtn.disabled = false;
    writeBtn.textContent = 'Write a tag';
    const advice = nfcTagAdvice(data.url.length);
    warnEl.hidden = !advice;
    if (advice) warnEl.textContent = advice;
  }

  setNfcState('idle');
  _nfcLastFocus = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  setBackdropInert(true);
  document.getElementById('nfc-close')?.focus();
}

function closeNfc() {
  const modal = document.getElementById('nfc-modal');
  if (!modal) return;
  if (_nfcAbort) { _nfcAbort.abort(); _nfcAbort = null; }
  modal.hidden = true;
  document.body.style.overflow = '';
  setBackdropInert(false);
  if (_nfcLastFocus && _nfcLastFocus.focus) _nfcLastFocus.focus();
}

async function writeNfc() {
  const data = buildShareData(profile, activeBucketId);
  if (!data || data.validCount === 0) return;

  const statusEl = document.getElementById('nfc-status');
  const writeBtn = document.getElementById('nfc-write');

  setNfcState('writing');
  statusEl.textContent = 'Hold the top of your phone against the tag…';
  writeBtn.disabled = true;
  writeBtn.textContent = 'Waiting for tag…';

  _nfcAbort = new AbortController();
  const timer = setTimeout(() => { if (_nfcAbort) _nfcAbort.abort(); }, 30000);

  try {
    const ndef = new NDEFReader();
    await ndef.write(
      { records: [{ recordType: 'url', data: data.url }] },
      { signal: _nfcAbort.signal }
    );
    clearTimeout(timer);
    setNfcState('done');
    statusEl.textContent = 'Done! Your card’s link is on the tag.';
    writeBtn.disabled = false;
    writeBtn.textContent = 'Write another tag';
  } catch (err) {
    clearTimeout(timer);
    setNfcState('error');
    statusEl.textContent = nfcErrorMessage(err);
    writeBtn.disabled = false;
    writeBtn.textContent = 'Try again';
  } finally {
    _nfcAbort = null;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

let _savedTimer = null;
function autosave() {
  debouncedSave(profile);
  clearTimeout(_savedTimer);
  _savedTimer = setTimeout(() => {
    flashSaved();
    refreshBackupNudge();
  }, 400);
}

function flashSaved() {
  const el = document.getElementById('saved-indicator');
  el.textContent = 'Saved';
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 1400);
}

function refreshBackupNudge() {
  const nudge = document.getElementById('backup-nudge');
  if (nudge) nudge.hidden = !needsBackup();
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('visible'), 2500);
}

function el(parent, tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

// ── Start ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}
