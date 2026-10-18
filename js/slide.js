// Draws one face of the double-sided speed slide into <defs>, so both sides
// of the computer can show it with <use>. Coordinates: x across the slide,
// y = v (distance from the slide's top edge), in slide units.

import { el, uid, r3 } from './svg.js';
import { SLIDE, originV } from './windmath.js';

const RAD = Math.PI / 180;
const EPS = 1e-9;

const isMultiple = (value, step) => Math.abs(value / step - Math.round(value / step)) < EPS;

export function buildSlideFace(face, defs) {
  const W = SLIDE.halfWidth;
  const O = originV(face);
  const g = el('g', { id: `slide-face-${face.id}`, class: `slide-face face-${face.id}` }, defs);

  const clipId = uid('clip');
  el('rect', { x: -W, y: 0, width: 2 * W, height: SLIDE.length, rx: 5 }, el('clipPath', { id: clipId }, defs));
  const polarClipId = uid('clip');
  el('rect', { x: -W, y: 0, width: 2 * W, height: face.gridTopV }, el('clipPath', { id: polarClipId }, defs));

  el('rect', { x: -W, y: 0, width: 2 * W, height: SLIDE.length, rx: 5, class: 'slide-bg' }, g);
  const art = el('g', { 'clip-path': `url(#${clipId})` }, g);
  const polar = el('g', { 'clip-path': `url(#${polarClipId})` }, art);

  // Speed arcs: circles about the zero-speed origin.
  const minorArcs = [];
  const boldArcs = [];
  for (let s = face.min; s <= face.max + EPS; s += face.arcStep) {
    const r = r3(s * face.unit);
    (isMultiple(s, face.arcBold) ? boldArcs : minorArcs).push(`M${-r} ${O}A${r} ${r} 0 0 1 ${r} ${O}`);
  }

  // Drift lines: every 2° from the lowest arc, every 1° above `oneDegreeFrom`.
  const minorLines = [];
  const boldLines = [];
  for (let d = -face.driftMax; d <= face.driftMax; d++) {
    const r0 = (d % 2 ? face.oneDegreeFrom : face.min) * face.unit;
    const r1 = O + 20;
    const sx = Math.sin(d * RAD);
    const cy = Math.cos(d * RAD);
    const path = `M${r3(r0 * sx)} ${r3(O - r0 * cy)}L${r3(r1 * sx)} ${r3(O - r1 * cy)}`;
    (d % 5 === 0 ? boldLines : minorLines).push(path);
  }
  el('path', { d: minorArcs.join('') + minorLines.join(''), class: 'slide-line' }, polar);
  el('path', { d: boldArcs.join('') + boldLines.join(''), class: 'slide-line bold' }, polar);
  el('path', { d: `M0 ${r3(O - face.min * face.unit)}V0`, class: 'slide-line centre' }, polar);

  // Speed numbers on the centre line.
  for (let s = face.min; s <= face.max + EPS; s += face.arcStep) {
    if (!isMultiple(s, face.arcLabel)) continue;
    const y = O - s * face.unit;
    if (y < 3.5) continue;
    el('text', { x: 0, y: r3(y), dy: '0.35em', 'text-anchor': 'middle', class: 'slide-num halo', text: String(s) }, art);
  }

  // Drift numbers, repeated at several heights so some are always in the window.
  for (const s of face.driftLabelArcs) {
    const r = s * face.unit;
    for (let d = 5; d <= face.driftMax; d += 5) {
      const step = r * 5 * RAD > 9 ? 5 : r * 10 * RAD > 9 ? 10 : 0;
      if (!step || d % step) continue;
      for (const side of [-1, 1]) {
        const x = side * r * Math.sin(d * RAD);
        const y = O - r * Math.cos(d * RAD);
        if (Math.abs(x) > SLIDE.halfWidth - 4 || y < 4 || y > face.gridTopV - 3) continue;
        el('text', { x: r3(x), y: r3(y), dy: '0.35em', 'text-anchor': 'middle', class: 'slide-drift halo', text: String(d) }, art);
      }
    }
  }

  // Square grid below the arcs, same scale as the speed arcs.
  const grid = [];
  const gridBold = [];
  for (let k = 0; face.gridTopV + k * face.gridStep <= SLIDE.length + EPS; k++) {
    const y = r3(face.gridTopV + k * face.gridStep);
    (k % face.gridBoldEvery === 0 ? gridBold : grid).push(`M${-W} ${y}H${W}`);
  }
  for (let k = 0; k * face.gridStep <= W + EPS; k++) {
    for (const side of k ? [-1, 1] : [1]) {
      const x = r3(side * k * face.gridStep);
      (k % face.gridBoldEvery === 0 ? gridBold : grid).push(`M${x} ${face.gridTopV}V${SLIDE.length}`);
    }
  }
  el('path', { d: grid.join(''), class: 'grid-line' }, art);
  el('path', { d: gridBold.join(''), class: 'grid-line bold' }, art);
  el('path', { d: `M${-W} ${face.gridTopV}H${W}`, class: 'grid-top' }, art);
  for (let k = face.gridLabelEvery; face.gridTopV + k * face.gridStep < SLIDE.length - 2; k += face.gridLabelEvery) {
    const value = Math.round(k * face.gridStep / face.unit);
    el('text', { x: 0, y: r3(face.gridTopV + k * face.gridStep), dy: '0.35em', 'text-anchor': 'middle', class: 'grid-num halo', text: String(value) }, art);
  }
  for (let k = face.gridLabelEvery; k * face.gridStep < W - 3; k += face.gridLabelEvery) {
    const value = String(Math.round(k * face.gridStep / face.unit));
    for (const side of [-1, 1]) {
      el('text', { x: r3(side * k * face.gridStep), y: face.gridTopV + 3.2, dy: '0.35em', 'text-anchor': 'middle', class: 'grid-num small halo', text: value }, art);
    }
  }

  el('text', { x: W - 7, y: 9, dy: '0.35em', 'text-anchor': 'middle', class: 'slide-face-id', text: face.id }, art);
  el('text', { x: -W + 4, y: 4.5, dy: '0.35em', class: 'slide-top', text: `▲ TOP · ${face.id === 'L' ? 'LOW' : 'HIGH'} SPEED` }, art);

  return g;
}
