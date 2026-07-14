// Builds the share link / QR payload for a group.

import { REGISTRY, isValidValue } from './registry.js';
import { pack, encodeValueScrambleSafe } from './scramble.js';
import { DEFAULT_P, DEFAULT_A } from './util.js';

function encodeFragment(pairs) {
  const plain = pairs.map(([k, v]) => `${k}=${encodeValueScrambleSafe(v)}`).join('&');
  return pack(plain);
}

function viewerURL(fragment) {
  const hash = fragment ? `#${fragment}` : '';
  return `${location.origin}/c${hash}`;
}

export function buildShareData(profile, bucketId) {
  const bucket = profile.buckets.find(b => b.id === bucketId);
  if (!bucket) return null;

  const pairs = [];
  let hasInvalid = false;
  let validCount = 0;

  for (const key of bucket.members) {
    const val = (profile.handles[key] || '').trim();
    if (!val) continue;

    const base = key.replace(/_\d+$/, '');
    const reg = REGISTRY.find(r => r.key === base);
    if (!reg) continue;

    if (!isValidValue(reg, val)) { hasInvalid = true; continue; }

    pairs.push([key, val]);
    const lbl = profile.labels && profile.labels[key];
    if (lbl) pairs.push([`lbl_${key}`, lbl]);
    validCount++;
  }

  if (profile.scheme.p && profile.scheme.p !== DEFAULT_P) pairs.push(['p', profile.scheme.p]);
  if (profile.scheme.a && profile.scheme.a !== DEFAULT_A) pairs.push(['a', profile.scheme.a]);
  if (profile.font && profile.font !== 'k') pairs.push(['f', profile.font]);

  // Per-group display name overrides the profile-wide one
  const displayName = bucket.displayName || profile.name;
  if (displayName) pairs.push(['nm', displayName]);

  const fragment = encodeFragment(pairs);
  const url = viewerURL(fragment);

  return { url, fragment, validCount, hasInvalid, length: url.length };
}

export function lengthLevel(len) {
  if (len >= 380) return 2;
  if (len >= 230) return 1;
  return 0;
}
