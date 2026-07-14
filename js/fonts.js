export const FONTS = [
  { code: 'k', label: 'Karrik',           css: "'Karrik', -apple-system, BlinkMacSystemFont, sans-serif" },
  { code: 'c', label: 'Inter',            css: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" },
  { code: 's', label: 'Instrument Serif', css: "'Instrument Serif', Georgia, serif" },
  { code: 'm', label: 'JetBrains Mono',   css: "'JetBrains Mono', ui-monospace, Menlo, monospace" },
];

export function fontByCode(code) {
  return FONTS.find(f => f.code === code) || FONTS[0];
}

export function isFontCode(code) {
  return FONTS.some(f => f.code === code);
}
