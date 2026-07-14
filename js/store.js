import { cleanLabel } from './text.js';
import { unpack } from './scramble.js';
import { REGISTRY } from './registry.js';
import { isFontCode } from './fonts.js';
import { HEX6, DEFAULT_P, DEFAULT_A, toBase64Url, fromBase64Url } from './util.js';

const STORE_KEY = 'canid:v3';
const LEGACY_KEY = 'canid:v2';
const EDIT_KEY = 'canid:lastEdit';
const BACKUP_KEY = 'canid:lastBackup';
const CORRUPT_KEY = 'canid:v3:corrupt';

function lsGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
}

let saveErrorHandler = null;
let lastSaveFailed = false;
export function onSaveError(fn) { saveErrorHandler = fn; }

function reportSave(ok) {
  if (!ok && !lastSaveFailed && saveErrorHandler) saveErrorHandler();
  lastSaveFailed = !ok;
}

function genId() {
  try { return 'p_' + crypto.randomUUID().slice(0, 8); }
  catch (_) { return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
}

// ── Profile / store shape ────────────────────────────────────────────────────

function seedDefault() {
  return {
    v: 2,
    name: '',
    scheme: { p: DEFAULT_P, a: DEFAULT_A },
    handles: {},
    labels: {},
    buckets: [
      { id: 'b_pub', name: 'Everyone', members: [] },
      { id: 'b_per', name: 'Friends',  members: [] },
      { id: 'b_int', name: 'Close',    members: [] },
    ],
    defaultBucketId: 'b_per',
    ui: { safeMode: false },
  };
}

function normalizeProfile(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('not an object');
  if (!Array.isArray(obj.buckets) || obj.buckets.length === 0) throw new Error('no buckets');

  const buckets = obj.buckets.map(b => {
    if (!b || typeof b.id !== 'string' || typeof b.name !== 'string') throw new Error('bad bucket');
    const members = Array.isArray(b.members) ? b.members.filter(m => typeof m === 'string') : [];
    const bucket = { id: b.id, name: cleanLabel(b.name, 30), members };
    const displayName = cleanLabel(b.displayName);
    if (displayName) bucket.displayName = displayName;
    return bucket;
  });

  const handles = {};
  if (obj.handles && typeof obj.handles === 'object') {
    for (const [k, v] of Object.entries(obj.handles)) {
      if (typeof v === 'string') handles[k] = v;
    }
  }

  const labels = {};
  if (obj.labels && typeof obj.labels === 'object') {
    for (const [k, v] of Object.entries(obj.labels)) {
      if (typeof v === 'string') {
        const clean = cleanLabel(v);
        if (clean) labels[k] = clean;
      }
    }
  }

  const name = cleanLabel(obj.name);

  const scheme = obj.scheme && typeof obj.scheme === 'object' ? obj.scheme : {};
  const p = HEX6.test(scheme.p || '') ? scheme.p : DEFAULT_P;
  const a = HEX6.test(scheme.a || '') ? scheme.a : DEFAULT_A;

  const defaultBucketId = buckets.some(b => b.id === obj.defaultBucketId)
    ? obj.defaultBucketId : buckets[0].id;

  const ui = obj.ui && typeof obj.ui === 'object' ? obj.ui : {};

  const out = {
    v: 2,
    name,
    scheme: { p, a },
    handles,
    labels,
    buckets,
    defaultBucketId,
    ui: { safeMode: !!ui.safeMode },
  };
  if (isFontCode(obj.font) && obj.font !== 'k') out.font = obj.font;
  return out;
}

function makeEntry(obj, fallbackName) {
  const base = normalizeProfile(obj);
  const id = typeof obj.id === 'string' && obj.id ? obj.id : genId();
  const profileName = cleanLabel(obj.profileName, 30) || fallbackName || 'Main';
  const mt = Number.isFinite(obj.mt) ? obj.mt : 0;
  return { id, profileName, mt, ...base };
}

function freshEntry(name) {
  return { id: genId(), profileName: name || 'Main', mt: Date.now(), ...seedDefault() };
}

function normalizeStore(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.profiles)) throw new Error('not a store');
  const seen = new Set();
  const profiles = [];
  for (const raw of obj.profiles) {
    let entry;
    try { entry = makeEntry(raw); } catch (_) { continue; }
    while (seen.has(entry.id)) entry.id = genId();
    seen.add(entry.id);
    profiles.push(entry);
  }
  if (!profiles.length) throw new Error('no valid profiles');
  const activeId = profiles.some(p => p.id === obj.activeId) ? obj.activeId : profiles[0].id;
  return { v: 3, activeId, profiles };
}

// ── In-memory store ──────────────────────────────────────────────────────────

let _store = null;

function persist() {
  const ok = lsSet(STORE_KEY, JSON.stringify(_store));
  reportSave(ok);
  return ok;
}

function bumpEdit() { lsSet(EDIT_KEY, String(Date.now())); }

function loadStore() {
  if (_store) return _store;

  const raw = lsGet(STORE_KEY);
  if (raw) {
    try { _store = normalizeStore(JSON.parse(raw)); return _store; }
    catch (_) { lsSet(CORRUPT_KEY, raw); }
  }

  const legacy = lsGet(LEGACY_KEY);
  if (legacy) {
    try {
      const entry = makeEntry(JSON.parse(legacy), 'Main');
      _store = { v: 3, activeId: entry.id, profiles: [entry] };
      persist();
      return _store;
    } catch (_) {}
  }

  const entry = freshEntry();
  _store = { v: 3, activeId: entry.id, profiles: [entry] };
  persist();
  return _store;
}

function entryHasHandles(entry) {
  return Object.values(entry.handles).some(v => v && v.trim());
}

function isFreshStore(store) {
  return store.profiles.length === 1 && !entryHasHandles(store.profiles[0]);
}

// ── Public: profiles ─────────────────────────────────────────────────────────

export function listProfiles() {
  return loadStore().profiles.map(p => ({
    id: p.id, profileName: p.profileName, p: p.scheme.p, a: p.scheme.a,
    hasHandles: entryHasHandles(p),
  }));
}

export function getActiveId() { return loadStore().activeId; }

export function getActiveProfile() {
  const store = loadStore();
  return store.profiles.find(p => p.id === store.activeId) || store.profiles[0];
}

export function switchActive(id) {
  const store = loadStore();
  if (!store.profiles.some(p => p.id === id)) return false;
  store.activeId = id;
  persist();
  return true;
}

export function createProfile(profileName) {
  const store = loadStore();
  const entry = freshEntry(cleanLabel(profileName, 30) || 'New profile');
  store.profiles.push(entry);
  bumpEdit();
  persist();
  return entry.id;
}

export function renameProfile(id, profileName) {
  const store = loadStore();
  const entry = store.profiles.find(p => p.id === id);
  if (!entry) return false;
  entry.profileName = cleanLabel(profileName, 30) || entry.profileName;
  entry.mt = Date.now();
  persist();
  return true;
}

export function deleteProfile(id) {
  const store = loadStore();
  if (store.profiles.length <= 1) return false;
  store.profiles = store.profiles.filter(p => p.id !== id);
  if (store.activeId === id) store.activeId = store.profiles[0].id;
  bumpEdit();
  persist();
  return true;
}

// ── Public: active-profile save (compatible with the editor's calls) ─────────

export function saveProfile(profile) {
  const store = loadStore();
  const i = store.profiles.findIndex(p => p.id === profile.id);
  if (i === -1) return false;
  profile.mt = Date.now();
  store.profiles[i] = profile;
  bumpEdit();
  return persist();
}

let _saveTimer = null;
export function debouncedSave(profile) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => saveProfile(profile), 300);
}

export function flushSave(profile) {
  if (_saveTimer === null) return;
  clearTimeout(_saveTimer);
  _saveTimer = null;
  saveProfile(profile);
}

// ── Backup state ─────────────────────────────────────────────────────────────

export function markBackedUp() { lsSet(BACKUP_KEY, String(Date.now())); }

export function needsBackup() {
  const store = loadStore();
  if (!store.profiles.some(entryHasHandles)) return false;
  const edited = Number(lsGet(EDIT_KEY)) || 0;
  const backed = Number(lsGet(BACKUP_KEY)) || 0;
  return edited > backed;
}

export async function ensurePersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch (_) {}
}

// ── Backup encode / decode (whole collection) ────────────────────────────────

export function encodeAllBackup() {
  return toBase64Url(JSON.stringify(loadStore()));
}

export function backupJSON() {
  return JSON.stringify(loadStore(), null, 2);
}

// Accepts either the new collection format or a single legacy profile.
function asStore(decoded) {
  if (decoded && Array.isArray(decoded.profiles)) return normalizeStore(decoded);
  const entry = makeEntry(decoded);
  return { v: 3, activeId: entry.id, profiles: [entry] };
}

function decodeStore(b64) {
  return asStore(JSON.parse(fromBase64Url(b64)));
}

function cardLinkToStore(text) {
  let raw = (text || '').trim();
  const hashAt = raw.indexOf('#');
  if (hashAt !== -1) raw = raw.slice(hashAt + 1);
  if (!raw) throw new Error('empty card link');

  const params = new URLSearchParams(unpack(raw));
  const handles = {};
  const labels = {};
  for (const [key, val] of params.entries()) {
    if (key === 'p' || key === 'a' || key === 'nm' || key === 'f') continue;
    if (key.startsWith('lbl_')) { labels[key.slice(4)] = val; continue; }
    const base = key.replace(/_\d+$/, '');
    if (!REGISTRY.some(r => r.key === base)) continue;
    if (val.trim()) handles[key] = val.trim();
  }
  if (!Object.keys(handles).length) throw new Error('no handles in link');

  const seed = seedDefault();
  seed.handles = handles;
  seed.labels = labels;
  seed.name = params.get('nm') || '';
  const p = params.get('p') || '';
  const a = params.get('a') || '';
  if (HEX6.test(p)) seed.scheme.p = p;
  if (HEX6.test(a)) seed.scheme.a = a;
  const f = params.get('f') || '';
  if (isFontCode(f) && f !== 'k') seed.font = f;
  for (const bucket of seed.buckets) bucket.members = Object.keys(handles);

  const entry = makeEntry({
    ...seed,
    mt: Date.now(),
    profileName: seed.name ? `${seed.name} (imported)` : 'Imported card',
  });
  return { v: 3, activeId: entry.id, profiles: [entry] };
}

export function decodeBackupInput(text) {
  let s = (text || '').trim();
  const i = s.indexOf('#b=');
  if (i !== -1) return decodeStore(s.slice(i + 3));
  if (s.startsWith('b=')) return decodeStore(s.slice(2));
  try { return decodeStore(s); }
  catch (_) { return cardLinkToStore(s); }
}

export function restoreBackup(incoming) {
  const store = loadStore();
  const base = isFreshStore(store) ? [] : store.profiles;
  const byId = new Map(base.map(p => [p.id, p]));
  let added = 0;
  let updated = 0;
  for (const p of incoming.profiles) {
    const existing = byId.get(p.id);
    if (!existing) {
      byId.set(p.id, p);
      added++;
    } else if ((p.mt || 0) > (existing.mt || 0)) {
      byId.set(p.id, p);
      updated++;
    }
  }
  store.profiles = [...byId.values()];
  if (!store.profiles.length) store.profiles = [freshEntry()];
  if (!store.profiles.some(p => p.id === store.activeId)) {
    store.activeId = byId.has(incoming.activeId) ? incoming.activeId : store.profiles[0].id;
  }
  bumpEdit();
  persist();
  return { added, updated, total: store.profiles.length };
}

// ── Backup-link restore on first load ────────────────────────────────────────

function readBackupFragment() {
  if (!location.hash.startsWith('#b=')) return null;
  try { return decodeStore(location.hash.slice(3)); }
  catch (_) { return null; }
}

export function clearBackupFragment() {
  history.replaceState(null, '', location.pathname + location.search);
}

export function loadOrRestore() {
  const store = loadStore();
  const backup = readBackupFragment();

  if (backup && isFreshStore(store)) {
    restoreBackup(backup);
    return { profile: getActiveProfile(), restored: true, pendingRestore: null };
  }

  return { profile: getActiveProfile(), restored: false, pendingRestore: backup };
}
