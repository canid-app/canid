// Shared text sanitizer for any human-entered string that gets rendered
// (display name, custom labels). Strips characters that enable visual
// text-spoofing or break layout but are otherwise invisible:
//   - C0/C1 control characters and DEL
//   - soft hyphen, line/paragraph separators
//   - zero-width and bidirectional formatting characters (RLO/LRO, isolates,
//     ZWSP/ZWNJ/ZWJ, word joiner, BOM)
// Used by both the editor (store) and the viewer so they agree.

// Inclusive code-point ranges to remove. Kept as numbers so the source stays
// pure ASCII (the characters themselves are invisible and easy to mangle).
const STRIP_RANGES = [
  [0x00, 0x1f],     // C0 controls
  [0x7f, 0x9f],     // DEL + C1 controls
  [0xad, 0xad],     // soft hyphen
  [0x200b, 0x200f], // ZWSP, ZWNJ, ZWJ, LRM, RLM
  [0x2028, 0x2029], // line / paragraph separators
  [0x202a, 0x202e], // bidi embeddings & overrides (LRO/RLO etc.)
  [0x2060, 0x206f], // word joiner, isolates, deprecated format chars
  [0xfeff, 0xfeff], // BOM / zero-width no-break space
];

function isStripped(cp) {
  for (const [lo, hi] of STRIP_RANGES) if (cp >= lo && cp <= hi) return true;
  return false;
}

export function sanitizeText(v) {
  if (typeof v !== 'string') return '';
  let out = '';
  for (const ch of v) {
    if (!isStripped(ch.codePointAt(0))) out += ch;
  }
  return out;
}

// Sanitize, cap to a code-point length (so astral chars aren't cut mid-pair),
// and trim. Used for display name and labels.
export function cleanLabel(v, max = 40) {
  return Array.from(sanitizeText(v)).slice(0, max).join('').trim();
}
