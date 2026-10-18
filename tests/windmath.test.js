import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as wm from '../js/windmath.js';

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label ?? ''} expected ${expected} ± ${tolerance}, got ${actual}`);

const L = wm.FACES.L;
const H = wm.FACES.H;

// Mark the wind "down" from the centre dot, set TAS and heading, read the cross.
function solveOnInstrument(face, { heading, tas, windFrom, windSpeed }) {
  const cross = wm.markBelowCentre(windFrom, windSpeed * face.unit);
  const reading = wm.readPoint(face, wm.speedToV(face, tas), wm.discToScreen(cross, heading));
  return { groundSpeed: reading.speed, drift: reading.drift, track: wm.mod360(heading + reading.drift) };
}

test('slide geometry: speeds map to the right place', () => {
  near(wm.vToSpeed(L, wm.speedToV(L, 137)), 137, 1e-9);
  near(wm.speedToV(L, 300), L.topV, 1e-9);
  near(wm.speedToV(H, 1000), H.topV, 1e-9);
  assert.ok(wm.speedToV(L, L.min) < L.gridTopV, 'L arcs sit above the square grid');
  assert.ok(wm.speedToV(H, H.min) < H.gridTopV, 'H arcs sit above the square grid');
  assert.ok(wm.speedToV(L, L.min) < wm.SLIDE.length && wm.speedToV(H, H.min) < wm.SLIDE.length);
});

test('track and GS – Hdg 116, TAS 120, W/V 260/40 gives Trk 107, GS 154', () => {
  const r = solveOnInstrument(L, { heading: 116, tas: 120, windFrom: 260, windSpeed: 40 });
  near(r.groundSpeed, 154.2, 0.1);
  near(r.drift, -8.8, 0.1);
  near(r.track, 107.2, 0.1);
});

test('the instrument agrees with the exact vector solution on both faces', () => {
  const cases = [
    [L, { heading: 40, tas: 150, windFrom: 310, windSpeed: 30 }],
    [L, { heading: 200, tas: 210, windFrom: 319, windSpeed: 37 }],
    [L, { heading: 359, tas: 95, windFrom: 10, windSpeed: 25 }],
    [H, { heading: 227, tas: 420, windFrom: 177, windSpeed: 60 }],
    [H, { heading: 90, tas: 480, windFrom: 300, windSpeed: 110 }],
  ];
  for (const [face, problem] of cases) {
    const onInstrument = solveOnInstrument(face, problem);
    const exact = wm.solveTriangle(problem);
    near(onInstrument.groundSpeed, exact.groundSpeed, 1e-6, `${face.id} GS`);
    near(onInstrument.drift, exact.drift, 1e-6, `${face.id} drift`);
  }
});

test('finding the wind: a cross on the drift line and GS arc reads back as the W/V', () => {
  // Hdg 227, TAS 420, Trk 234 (7° S), GS 385 (H side). Exact vector answer:
  // W/V 175.9°/60.3 kt, which a slide-rule reading rounds to about 177/60.
  const heading = 227;
  const vc = wm.speedToV(H, 420);
  const drift = 7 * Math.PI / 180;
  const r = 385 * H.unit;
  // Where the 7° S drift line meets the 385 kt arc, relative to the centre dot.
  const screen = [r * Math.sin(drift), wm.originV(H) - r * Math.cos(drift) - vc];
  const w = wm.vectorFromCentre(wm.screenToDisc(screen, heading), H);
  near(w.from, 175.9, 0.1, 'direction');
  near(w.speed, 60.3, 0.1, 'speed');
});

test('runway components on the square grid – RWY 27, W/V 230/20', () => {
  const cross = wm.markBelowCentre(230, 20 * L.unit);
  const [x, y] = wm.discToScreen(cross, 270);
  near(y / L.unit, 15.3, 0.1, 'headwind');
  near(x / L.unit, 12.9, 0.1, 'crosswind from the left');
});

test('rotation helpers are inverses', () => {
  const p = [12.3, -45.6];
  const back = wm.screenToDisc(wm.discToScreen(p, 123.4), 123.4);
  near(back[0], p[0], 1e-9);
  near(back[1], p[1], 1e-9);
});

test('a line along a drift line spans the window and stays on that drift line', () => {
  const vc = wm.speedToV(L, 150);
  const [a, b] = wm.driftLineChord(L, vc, 8);
  near(Math.hypot(...b), wm.WINDOW_RADIUS, 1e-6, 'ends on the window edge');
  for (const p of [a, b]) near(wm.readPoint(L, vc, p).drift, 8, 1e-6, 'on the 8° S drift line');
  assert.equal(wm.driftLineChord(L, wm.speedToV(L, 300), 60), null, 'misses the window when it cannot cross it');
});

test('Shift-snapping puts the end of a line on the drift line through its start', () => {
  const vc = wm.speedToV(L, 180);
  const start = [10, -5];
  const snapped = wm.snapToDriftLine(L, vc, start, [30, 40]);
  near(wm.readPoint(L, vc, snapped).drift, wm.readPoint(L, vc, start).drift, 1e-9);
});

test('wind from drift on two headings: lines cross at the wind cross (TAS 220, 195°/6° S, 278°/4° P)', () => {
  const vc = wm.speedToV(L, 220);
  const along = (heading, drift) => wm.driftLineChord(L, vc, drift).map(p => wm.screenToDisc(p, heading));
  const [a1, b1] = along(195, 6);
  const [a2, b2] = along(278, -4);
  const w = wm.vectorFromCentre(wm.lineIntersection(a1, b1, a2, b2), L);
  near(w.from, 65.9, 0.1, 'direction');
  near(w.speed, 32.6, 0.1, 'speed');
});
