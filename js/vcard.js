// Builds a vCard (.vcf) from a decoded card and hands it to the OS so the
// viewer can "Add to contacts".
//
// Mapping:
//   name   → FN / N
//   email  → EMAIL
//   phone  → TEL
//   canid card link + every other linkable network → labelled URL rows
//   app-only handles (Discord/Signal/…, no public URL) and notes → NOTE

const CRLF = '\r\n';

function esc(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

// Fold a content line to <=75 octets with CRLF + single space continuation.
//
// Counts UTF-8 bytes and steps by code point. Slicing by JS string index would
// cut an astral character (emoji) in half whenever its surrogate pair straddled
// a fold boundary, and the halves become replacement characters once the file is
// written as UTF-8. Notes are the only field long enough to fold, and they carry
// emoji. Splitting a grapheme across lines is fine — unfolding rejoins it.
const ENC = new TextEncoder();

function fold(line) {
  if (ENC.encode(line).length <= 75) return line;
  const max = 73;
  const lines = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = ENC.encode(ch).length;
    if (bytes + n > max) { lines.push(cur); cur = ''; bytes = 0; }
    cur += ch;
    bytes += n;
  }
  if (cur) lines.push(cur);
  return lines.join(CRLF + ' ');
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
      notes.push(entryLabel(entry) + ': ' + val);
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
