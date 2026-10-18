// Small helpers for building the instrument out of SVG.
// Angles are degrees clockwise from 12 o'clock; y runs down the screen.

export const SVG_NS = 'http://www.w3.org/2000/svg';
const RAD = Math.PI / 180;
let idCounter = 0;

export const uid = prefix => `${prefix}-${++idCounter}`;
export const r3 = n => Math.round(n * 1000) / 1000;

export function el(tag, attrs, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    }
  }
  if (parent) parent.appendChild(node);
  return node;
}

/** Point at radius r and angle a. */
export function polar(r, a) {
  return [r * Math.sin(a * RAD), -r * Math.cos(a * RAD)];
}

/** Radial line segment from r0 to r1 at angle a. */
export function radial(r0, r1, a) {
  const [x0, y0] = polar(r0, a);
  const [x1, y1] = polar(r1, a);
  return `M${r3(x0)} ${r3(y0)}L${r3(x1)} ${r3(y1)}`;
}

/** Arc of radius r from a0 to a1, clockwise if a1 > a0. */
export function arc(r, a0, a1, move = true) {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  const sweep = a1 >= a0 ? 1 : 0;
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `${move ? 'M' : 'L'}${r3(x0)} ${r3(y0)}A${r} ${r} 0 ${large} ${sweep} ${r3(x1)} ${r3(y1)}`;
}

/** Closed annular sector between radii r0 < r1 and angles a0 < a1. */
export function sector(r0, r1, a0, a1) {
  return `${arc(r1, a0, a1)}${arc(r0, a1, a0, false)}Z`;
}

export function circlePath(r) {
  return `M${-r} 0A${r} ${r} 0 1 1 ${r} 0A${r} ${r} 0 1 1 ${-r} 0Z`;
}

/** Small triangle at angle a with its tip at rTip and base at rBase. */
export function pointer(rTip, rBase, a, halfWidth) {
  const [tx, ty] = polar(rTip, a);
  const [lx, ly] = polar(rBase, a - halfWidth);
  const [rx, ry] = polar(rBase, a + halfWidth);
  return `M${r3(tx)} ${r3(ty)}L${r3(lx)} ${r3(ly)}L${r3(rx)} ${r3(ry)}Z`;
}

/**
 * Text centred on a point at (r, a), turned so its top faces away from the
 * centre, as numbers are printed on a circular slide rule. `upright` turns
 * it the other way so text below the centre reads the right way up;
 * 'radial' runs it outwards along the radius where space round the arc is short.
 */
export function radialText(parent, text, r, a, attrs = {}, upright = false) {
  const [x, y] = polar(r, a);
  const turn = upright === 'radial' ? a - 90 : upright ? a + 180 : a;
  return el('text', {
    ...attrs,
    transform: `translate(${r3(x)} ${r3(y)}) rotate(${r3(turn)})`,
    'text-anchor': 'middle',
    dy: '0.35em',
    text,
  }, parent);
}

/**
 * Text that follows a circle of radius r. `anchor` says which part of the
 * text sits at angle a: its middle, its start or its end.
 */
export function arcText(parent, defs, text, r, a, size, attrs = {}, upright = false, anchor = 'middle') {
  const id = uid('arc');
  // Shift the baseline so the glyphs straddle r.
  const rb = upright ? r + 0.35 * size : r - 0.35 * size;
  el('path', { id, d: upright ? arc(rb, a + 170, a - 170) : arc(rb, a - 170, a + 170) }, defs);
  const t = el('text', { ...attrs, 'font-size': size, 'text-anchor': anchor }, parent);
  el('textPath', { href: `#${id}`, startOffset: '50%', text }, t);
  return t;
}

/** Rounded polygon through `points`. */
export function roundedPolygon(points, radius) {
  const n = points.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const [px, py] = points[(i + n - 1) % n];
    const [vx, vy] = points[i];
    const [nx, ny] = points[(i + 1) % n];
    const lp = Math.hypot(px - vx, py - vy);
    const ln = Math.hypot(nx - vx, ny - vy);
    const a = [vx + (px - vx) * radius / lp, vy + (py - vy) * radius / lp];
    const b = [vx + (nx - vx) * radius / ln, vy + (ny - vy) * radius / ln];
    d += `${i ? 'L' : 'M'}${r3(a[0])} ${r3(a[1])}Q${vx} ${vy} ${r3(b[0])} ${r3(b[1])}`;
  }
  return `${d}Z`;
}
