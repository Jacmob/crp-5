// Builds the wind (triangle of velocities) side: the slide, the fixed
// drift/variation scale and TRUE HEADING index, and the rotating window disc
// with its azimuth ring.

import { el, radial, pointer, circlePath, radialText, arcText } from './svg.js';
import { drawBody } from './body.js';
import { SLIDE, WINDOW_RADIUS } from './windmath.js';

const RING_OUTER = 92;
const CARDINALS = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

export function buildWind(root, defs) {
  const slideHolder = el('g', { class: 'slide-holder' }, root);
  const slideUse = el('use', { href: '#slide-face-L' }, slideHolder);
  el('rect', { x: -SLIDE.halfWidth, y: 0, width: 2 * SLIDE.halfWidth, height: SLIDE.length, rx: 5, class: 'hit', 'data-hit': 'slide' }, slideHolder);

  drawBody(root, WINDOW_RADIUS);
  drawDriftScale(root, defs);

  const disc = el('g', { class: 'wind-disc' }, root);
  el('path', { d: circlePath(RING_OUTER) + circlePath(WINDOW_RADIUS), 'fill-rule': 'evenodd', class: 'ring' }, disc);
  const ticks = [];
  for (let d = 0; d < 360; d++) {
    ticks.push(radial(RING_OUTER - (d % 10 === 0 ? 4 : d % 5 === 0 ? 2.8 : 1.6), RING_OUTER, d));
    if (d % 10 === 0) radialText(disc, String(d), 85.3, d, { class: 'ring-num' });
    if (CARDINALS[d]) radialText(disc, CARDINALS[d], 79.2, d, { class: d % 90 ? 'ring-inter' : 'ring-cardinal' });
  }
  el('path', { d: ticks.join(''), class: 'tick' }, disc);
  el('circle', { r: WINDOW_RADIUS, class: 'window' }, disc);

  const clipId = 'window-clip';
  el('circle', { r: WINDOW_RADIUS - 0.4 }, el('clipPath', { id: clipId }, defs));
  const marks = el('g', { class: 'marks', 'clip-path': `url(#${clipId})` }, disc);
  // The ring turns the disc; the window itself moves the slide (or takes pencil marks).
  el('path', { d: circlePath(RING_OUTER) + circlePath(WINDOW_RADIUS), 'fill-rule': 'evenodd', class: 'hit', 'data-hit': 'wind-ring' }, disc);
  el('circle', { r: WINDOW_RADIUS, class: 'hit', 'data-hit': 'wind-window' }, disc);

  el('circle', { r: 1.5, class: 'centre-ring' }, root);
  el('circle', { r: 0.32, class: 'centre-dot' }, root);

  return { slideHolder, slideUse, disc, marks };
}

function drawDriftScale(g, defs) {
  const ticks = [];
  for (let d = -50; d <= 50; d++) {
    ticks.push(radial(RING_OUTER, RING_OUTER + (d % 10 === 0 ? 4 : d % 5 === 0 ? 3 : 1.8), d));
    if (d % 10 === 0 && d) radialText(g, String(Math.abs(d)), 98.7, d, { class: 'drift-num' });
  }
  el('path', { d: ticks.join(''), class: 'tick' }, g);
  el('path', { d: pointer(RING_OUTER + 0.3, RING_OUTER + 7.6, 0, 2.3), class: 'heading-index' }, g);
  arcText(g, defs, 'TRUE HEADING', 104.6, 0, 3.8, { class: 'wind-title' });
  arcText(g, defs, 'DRIFT PORT', 104.4, -42, 2.8, { class: 'wind-label' });
  arcText(g, defs, 'VAR EAST', 104.4, -24, 2.8, { class: 'wind-label' });
  arcText(g, defs, 'VAR WEST', 104.4, 24, 2.8, { class: 'wind-label' });
  arcText(g, defs, 'DRIFT STBD', 104.4, 42, 2.8, { class: 'wind-label' });
  arcText(g, defs, 'CRP-5 EMULATOR', 99.2, 180, 4.2, { class: 'brand' }, true);
  arcText(g, defs, 'OPEN SOURCE', 104.8, 180, 2.2, { class: 'brand-sub' }, true);
}

/** Draws pencil marks (in disc coordinates) into the marks layer. */
export function renderMarks(layer, marks) {
  layer.replaceChildren();
  for (const mark of marks) {
    if (mark.type === 'cross') {
      const [x, y] = mark.p;
      el('path', { d: `M${x - 2.2} ${y - 2.2}L${x + 2.2} ${y + 2.2}M${x - 2.2} ${y + 2.2}L${x + 2.2} ${y - 2.2}`, class: 'pencil' }, layer);
    } else if (mark.type === 'segment') {
      el('line', { x1: mark.a[0], y1: mark.a[1], x2: mark.b[0], y2: mark.b[1], class: 'pencil line' }, layer);
    } else if (mark.type === 'line' && mark.points.length > 1) {
      el('polyline', { points: mark.points.map(p => p.join(',')).join(' '), class: 'pencil line' }, layer);
    }
  }
}
