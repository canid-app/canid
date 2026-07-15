import { contrast } from './util.js';

let _last = null;

// Draws the QR and reports whether the data actually fit.
//
// A QR code has a hard ceiling (~2.3KB at error correction M).
//
// On failure a short placeholder is drawn so the caller has a real QR to blur
// behind its warning rather than an empty frame.
export function buildQR(url, container, params) {
  const QRCodeStyling = window.QRCodeStyling;
  if (!QRCodeStyling) { container.textContent = 'QR library not loaded'; return false; }

  container.innerHTML = '';
  try {
    const qr = new QRCodeStyling(buildOpts({ url, ...params }, {}));
    qr.append(container);
    makeResponsive(container, qr);
    _last = { url, ...params };
    return true;
  } catch (_) {
    _last = null; // nothing real to download or present
    container.innerHTML = '';
    try {
      const placeholder = new QRCodeStyling(buildOpts({ url: location.origin, ...params }, {}));
      placeholder.append(container);
      makeResponsive(container, placeholder);
    } catch (_) {
      container.innerHTML = '';
    }
    return false;
  }
}

function makeResponsive(container, qr) {
  const addViewBox = () => {
    const svg = container.querySelector('svg');
    if (!svg) return false;
    if (!svg.getAttribute('viewBox')) {
      const w = parseFloat(svg.getAttribute('width'));
      const h = parseFloat(svg.getAttribute('height'));
      if (!w || !h) return false;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    return true;
  };

  const promise = qr && qr._svgDrawingPromise;
  if (promise && typeof promise.then === 'function') {
    promise.then(addViewBox);
  } else if (!addViewBox()) {
    const obs = new MutationObserver(() => { if (addViewBox()) obs.disconnect(); });
    obs.observe(container, { childList: true, subtree: true });
  }
}

export async function downloadQR() {
  const QRCodeStyling = window.QRCodeStyling;
  if (!QRCodeStyling || !_last) return false;
  const size = 1024;
  const opts = buildOpts(_last, {
    size,
    margin: Math.round(size * 0.08),
    type: 'canvas',
  });
  await new QRCodeStyling(opts).download({ name: 'canid-qr', extension: 'png' });
  return true;
}

function buildOpts({ url, primary, accent, safeMode }, { size = 280, margin = 0, type = 'svg' }) {
  const guardedP = guard(primary);
  const guardedA = guard(accent);

  const opts = {
    width: size,
    height: size,
    type,
    margin,
    data: url,
    qrOptions: { errorCorrectionLevel: 'M' },
    backgroundOptions: { color: '#ffffff' },
  };

  if (safeMode) {
    opts.dotsOptions = { type: 'square', color: '#0a0a0b' };
    opts.cornersSquareOptions = { type: 'square', color: '#0a0a0b' };
    opts.cornersDotOptions =    { type: 'square', color: '#0a0a0b' };
  } else {
    opts.dotsOptions = {
      type: 'rounded',
      gradient: {
        type: 'linear',
        rotation: 45,
        colorStops: [
          { offset: 0, color: `#${guardedP}` },
          { offset: 1, color: `#${guardedA}` },
        ],
      },
    };
    opts.cornersSquareOptions = { type: 'extra-rounded', color: `#${guardedP}` };
    opts.cornersDotOptions =    { type: 'dot', color: `#${guardedA}` };
  }

  return opts;
}

// ── Contrast guard ─────────────────────────────────────────────────────────

// Darken hex toward black until it meets a 4.5:1 contrast ratio against bg.
function guard(hex, bg = 'ffffff') {
  if (hex.startsWith('#')) hex = hex.slice(1);
  if (bg.startsWith('#')) bg = bg.slice(1);
  if (contrast(hex, bg) >= 4.5) return hex;
  let [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < 64; i++) {
    r = Math.max(0, r - 4); g = Math.max(0, g - 4); b = Math.max(0, b - 4);
    const h = [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    if (contrast(h, bg) >= 4.5) return h;
  }
  return '0a0a0b';
}
