// Shared helpers
export const HEX6 = /^[0-9a-fA-F]{6}$/;

// Default theme colors
export const DEFAULT_P = 'ffb786';
export const DEFAULT_A = 'f57c00';

export function validHex(v) { return HEX6.test(v || ''); }

// '#'-less 6-digit hex
export function hexToRgb(hex) {
  const n = parseInt(hex, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

// WCAG relative luminance of a '#'-less 6-digit hex color.
function relLuminance(hex) {
  return [0, 2, 4].reduce((acc, i, idx) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    const lin = c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return acc + lin * [0.2126, 0.7152, 0.0722][idx];
  }, 0);
}

// WCAG contrast ratio between two '#'-less 6-digit hex colors.
export function contrast(hexA, hexB) {
  const l1 = relLuminance(hexA), l2 = relLuminance(hexB);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export function toBase64Url(json) {
  const bytes = new TextEncoder().encode(json);
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function fromBase64Url(b64) {
  const base64 = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Keep Tab focus inside an open dialog.
export function trapTab(e, dialog) {
  if (e.key !== 'Tab') return;
  const f = dialog.querySelectorAll('button:not([hidden]), [href], input, [tabindex]:not([tabindex="-1"])');
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
