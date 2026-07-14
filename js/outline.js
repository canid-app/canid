// Notched-card outline overlay.

const SVGNS = 'http://www.w3.org/2000/svg';

const _updates = new WeakMap();
const _ro = typeof ResizeObserver !== 'undefined'
  ? new ResizeObserver(entries => {
      for (const entry of entries) {
        if (!entry.target.isConnected) {
          _ro.unobserve(entry.target);
          _updates.delete(entry.target);
          continue;
        }
        _updates.get(entry.target)?.();
      }
    })
  : null;

export function addCardOutline(el, { notch = 16, ext = 24, inset = 1.25 } = {}) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'card-outline');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const notchPath = document.createElementNS(SVGNS, 'path');
  notchPath.setAttribute('class', 'co-notch');

  const draw = document.createElementNS(SVGNS, 'path');
  draw.setAttribute('class', 'co-draw');
  draw.setAttribute('pathLength', '1');

  svg.append(notchPath, draw);
  el.appendChild(svg);

  const N = notch;
  const i = inset;

  const update = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    notchPath.setAttribute('d',
      `M ${w - N - ext} ${i} L ${w - N} ${i} L ${w - i} ${N} L ${w - i} ${N + ext}`);
    draw.setAttribute('d',
      `M ${w - i} ${N + ext} L ${w - i} ${h - i} L ${i} ${h - i} L ${i} ${i} L ${w - N - ext} ${i}`);
  };

  update();
  if (_ro) {
    _updates.set(el, update);
    _ro.observe(el);
  }
  return update;
}
