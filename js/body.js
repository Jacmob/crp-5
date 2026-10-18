// The instrument's plastic body, shared by both sides. Units are slide units
// (see windmath.js); the slide runs vertically behind the body.

import { el, roundedPolygon } from './svg.js';

const W = 106;
const H = 114;
const CHAMFER = 30;

export const BODY = { halfWidth: W, halfHeight: H };

export function bodyOutline() {
  return roundedPolygon([
    [-W + CHAMFER, -H], [W - CHAMFER, -H], [W, -H + CHAMFER], [W, H - CHAMFER],
    [W - CHAMFER, H], [-W + CHAMFER, H], [-W, H - CHAMFER], [-W, -H + CHAMFER],
  ], 7);
}

const SCREW_INSET = CHAMFER / 2 + 4.5;

export function drawScrews(parent) {
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const g = el('g', { class: 'screw', transform: `translate(${sx * (W - SCREW_INSET)} ${sy * (H - SCREW_INSET)})` }, parent);
      el('circle', { r: 2.6 }, g);
      el('path', { d: 'M-1.6 -0.4L1.6 0.4', class: 'screw-slot' }, g);
    }
  }
}

/** Body with an optional circular hole, plus shadow and screws. */
export function drawBody(parent, holeRadius = 0) {
  const hole = holeRadius ? `M${-holeRadius} 0A${holeRadius} ${holeRadius} 0 1 1 ${holeRadius} 0A${holeRadius} ${holeRadius} 0 1 1 ${-holeRadius} 0Z` : '';
  el('path', { d: bodyOutline() + hole, class: 'body-shadow', 'fill-rule': 'evenodd', transform: 'translate(1.4 2.6)' }, parent);
  el('path', { d: bodyOutline() + hole, class: 'body hit', 'fill-rule': 'evenodd', 'data-hit': 'body' }, parent);
  drawScrews(parent);
}
