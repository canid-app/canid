import { cleanLabel } from './text.js';
import { HEX6, DEFAULT_P, DEFAULT_A, toBase64Url, fromBase64Url } from './util.js';

const KEY = 'canid:saved:v1';
const CAP = 500;
const MAX_FRAGMENT = 8192;


export const NAV_KEY = 'canid:nav';


function lsGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
}

// ── Normalisation ────────────────────────────────────────────────────────────

function validHex(v, fallback) { return HEX6.test(v || '') ? v : fallback; }

function normalizeEntry(e) {
  if (!e || typeof e !== 'object') return null;
  if (typeof e.fragment !== 'string') return null;
  const fragment = e.fragment;
  if (!fragment || fragment.length > MAX_FRAGMENT) return null;
  return {
    id: typeof e.id === 'string' && e.id ? e.id : newId(),
    fragment,
    note: cleanLabel(e.note),
    p: validHex(e.p, DEFAULT_P),
    a: validHex(e.a, DEFAULT_A),
    savedAt: Number.isFinite(e.savedAt) ? e.savedAt : Date.now(),
  };
}

function newId() {
  try { return crypto.randomUUID(); }
  catch (_) { return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
}

function readAll() {
  const raw = lsGet(KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeEntry).filter(Boolean);
  } catch (_) { return []; }
}

function writeAll(list) {
  const capped = list.slice(0, CAP);
  return lsSet(KEY, JSON.stringify(capped));
}

// ── Public API ───────────────────────────────────────────────────────────────

export function listSaved() {
  return readAll().sort((a, b) => b.savedAt - a.savedAt);
}

export function findSaved(fragment) {
  return readAll().find(e => e.fragment === fragment) || null;
}

export function addSaved({ fragment, note, p, a }) {
  const entry = normalizeEntry({ fragment, note, p, a, savedAt: Date.now() });
  if (!entry) return null;
  const list = readAll().filter(e => e.fragment !== entry.fragment);
  list.unshift(entry);
  writeAll(list.sort((x, y) => y.savedAt - x.savedAt));
  return entry;
}

export function updateNote(id, note) {
  const list = readAll();
  const e = list.find(x => x.id === id);
  if (!e) return false;
  e.note = cleanLabel(note);
  return writeAll(list);
}

export function removeSaved(id) {
  const list = readAll().filter(e => e.id !== id);
  return writeAll(list);
}

// ── Display helpers ──────────────────────────────────────────────────────────

export function formatSavedDate(ts) {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch (_) {
    return new Date(ts).toISOString().slice(0, 10);
  }
}


export function encodeSavedBackup() {
  return toBase64Url(JSON.stringify(listSaved()));
}

export function restoreSavedBackup(text) {
  let s = (text || '').trim();
  const i = s.indexOf('s=');
  if (i === 0 || (i > 0 && s[i - 1] === '#')) s = s.slice(i + 2);
  const incoming = JSON.parse(fromBase64Url(s));
  if (!Array.isArray(incoming)) throw new Error('not a saved-cards backup');

  const byFragment = new Map();
  for (const e of readAll()) byFragment.set(e.fragment, e);

  let added = 0;
  for (const raw of incoming) {
    const e = normalizeEntry(raw);
    if (!e) continue;
    const existing = byFragment.get(e.fragment);
    if (!existing) { byFragment.set(e.fragment, e); added++; }
    else if (e.savedAt > existing.savedAt) byFragment.set(e.fragment, e);
  }

  const merged = Array.from(byFragment.values()).sort((a, b) => b.savedAt - a.savedAt);
  writeAll(merged);
  return { added, total: merged.length };
}
