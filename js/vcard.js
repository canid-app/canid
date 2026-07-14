// Builds a vCard (.vcf) from a decoded card and hands it to the OS so the
// viewer can "Add to contacts".
//
// Mapping:
//   name   → FN / N
//   email  → EMAIL
//   phone  → TEL
//   canid card link + every other linkable network → labelled URL rows
//   app-only handles (Discord/Signal/…, no public URL) → NOTE

const CRLF = '\r\n';

function esc(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

// Fold a content line to <=75 octets with CRLF + single space continuation.
function fold(line) {
  if (line.length <= 75) return line;
  const max = 73;
  let out = line.slice(0, max);
  let i = max;
  while (i < line.length) {
    out += CRLF + ' ' + line.slice(i, i + max);
    i += max;
  }
  return out;
}

// The display label for a single linkable entry.
function entryLabel(entry) {
  const { reg, href, label, val } = entry;
  if (label) return label;
  if (reg.urlType && !reg.host && href) {
    try { return new URL(href).hostname; } catch (_) { /* fall through */ }
  }
  if (reg.pathLabel && val && val.includes('/')) return reg.pathLabel;
  return reg.label;
}

export function buildVCard({ entries, name, cardUrl }) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];

  const given = (name || '').trim();
  const firstEmail = entries.find(e => e.reg.key === 'em');
  const firstPhone = entries.find(e => e.reg.key === 'ph');
  const fn = given || (firstEmail && firstEmail.val) || (firstPhone && firstPhone.val) || 'canid contact';

  lines.push(fold('N:;' + esc(given) + ';;;'));
  lines.push(fold('FN:' + esc(fn)));

  let item = 0;
  const grouped = (url, label) => {
    item += 1;
    const g = 'item' + item;
    lines.push(fold(g + '.URL:' + esc(url)));
    lines.push(fold(g + '.X-ABLabel:' + esc(label)));
  };

  if (cardUrl) grouped(cardUrl, 'canid');

  const notes = [];
  for (const entry of entries) {
    const { reg, val, href } = entry;
    if (reg.key === 'em') {
      lines.push(fold('EMAIL;TYPE=INTERNET:' + esc(val)));
    } else if (reg.key === 'ph') {
      lines.push(fold('TEL;TYPE=CELL,VOICE:' + esc(val)));
    } else if (href) {
      grouped(href, entryLabel(entry));
    } else {
      notes.push(reg.label + ': ' + val);
    }
  }

  if (notes.length) lines.push(fold('NOTE:' + esc(notes.join('\n'))));

  lines.push('REV:' + new Date().toISOString().replace(/\.\d+/, ''));
  lines.push('END:VCARD');
  return lines.join(CRLF) + CRLF;
}

function fileName(name) {
  const safe = (name || '').trim().replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return (safe || 'contact') + '.vcf';
}

// Build the vCard and hand it to the OS
export async function exportContact(card) {
  const vcf = buildVCard(card);
  const name = fileName(card.name);
  const type = 'text/vcard;charset=utf-8';

  try {
    const file = new File([vcf], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: card.name || 'Contact card' });
      return;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;
  }

  const blob = new Blob([vcf], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
