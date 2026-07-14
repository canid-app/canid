// Scrambler for share fragments.
//
// THIS IS OBFUSCATION, NOT ENCRYPTION. The alphabets and rotation below are
// public in this file and the viewer reverses them with no secret.

const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

const IN  = UNRESERVED + '@:/=&%';
const OUT = UNRESERVED + '@:/=&+';
const N = IN.length; // 72

// Fixed public rotation keystream
const KEY = [17, 41, 5, 58, 29, 11, 63, 38, 7, 50, 23, 2, 67, 31, 13, 44];

const IN_INDEX  = Object.fromEntries([...IN].map((c, i) => [c, i]));
const OUT_INDEX = Object.fromEntries([...OUT].map((c, i) => [c, i]));

// Restrict a value so the pre-scramble fragment only ever uses chars in IN.
const LITERAL = /[A-Za-z0-9\-._~@:/]/;
export function encodeValueScrambleSafe(v) {
  let out = '';
  for (const ch of v) {
    if (LITERAL.test(ch)) { out += ch; continue; }
    for (const b of new TextEncoder().encode(ch)) {
      out += '%' + b.toString(16).toUpperCase().padStart(2, '0');
    }
  }
  return out;
}

function scramble(plain) {
  let out = '';
  for (let i = 0; i < plain.length; i++) {
    const idx = IN_INDEX[plain[i]];
    if (idx === undefined) { out += plain[i]; continue; }
    out += OUT[(idx + KEY[i % KEY.length]) % N];
  }
  return out;
}

function unscramble(scr) {
  let out = '';
  for (let i = 0; i < scr.length; i++) {
    const idx = OUT_INDEX[scr[i]];
    if (idx === undefined) { out += scr[i]; continue; }
    out += IN[(idx - KEY[i % KEY.length] + N * 8) % N];
  }
  return out;
}

// Fragment framing. A leading '~' marks a scrambled fragment. A trailing
// alphanumeric GUARD is appended so the URL can never END on a character that
// text auto-linkers trim
const MARK = '~';
const GUARD = 'z';

export function pack(plain) {
  return MARK + scramble(plain) + GUARD;
}

export function unpack(raw) {
  if (raw[0] !== MARK) return raw;
  return unscramble(raw.slice(1, -1));
}
