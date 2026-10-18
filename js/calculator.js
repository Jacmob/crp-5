// Builds the calculator (circular slide rule) side.
// Drawn in dial units (inner disc radius 100) inside a group scaled to fit
// the shared body. The layout follows the physical instrument: the slide-rule
// scales meet at a bold circle, an orange minutes-to-hours band sits inside
// the inner scale, and the windows are cut in the disc where the real ones are.

import { el, polar, radial, arc, sector, circlePath, pointer, radialText, arcText, r3 } from './svg.js';
import { drawBody } from './body.js';
import { SLIDE } from './windmath.js';
import * as cs from './calcscales.js';

export const DIAL_SCALE = 0.8;

const TICK = { label: 5.4, major: 4.4, mid: 3.6, minor: 2.6 };
const RING_OUTER = 124;     // edge of the grey scale ring on the body
const SCALE_BAND = 88;      // inner edge of the grey inner-scale band on the disc
const HOURS = [76, 88];     // orange hours band
const SG_LINE = 114.6;      // specific-gravity arcs
const DATUM_LABEL_R = 118.8;

const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const minus = n => String(n).replace('-', '−');

export function buildCalculator(root, defs) {
  const slideHolder = el('g', { class: 'slide-holder' }, root);
  const slideUse = el('use', { href: '#slide-face-H' }, slideHolder);
  el('rect', { x: -SLIDE.halfWidth, y: 0, width: 2 * SLIDE.halfWidth, height: SLIDE.length, rx: 5, class: 'hit', 'data-hit': 'slide' }, slideHolder);

  drawBody(root);

  const dial = el('g', { class: 'dial', transform: `scale(${DIAL_SCALE})` }, root);
  el('path', { d: circlePath(RING_OUTER) + circlePath(100), 'fill-rule': 'evenodd', class: 'scale-ring' }, dial);
  el('circle', { r: RING_OUTER, class: 'scale-ring-edge' }, dial);
  el('circle', { r: 100, class: 'base-under' }, dial);
  drawBaseScales(dial);
  drawOuterScale(dial, defs);
  el('path', { d: circlePath(131) + circlePath(100), 'fill-rule': 'evenodd', class: 'hit', 'data-hit': 'calc-ring' }, dial);

  const disc = el('g', { class: 'calc-disc' }, dial);
  drawDisc(disc, defs);
  el('circle', { r: 100, class: 'hit', 'data-hit': 'calc-disc' }, disc);

  const cursor = el('g', { class: 'calc-cursor' }, dial);
  drawCursor(cursor);

  el('circle', { r: 4.8, class: 'hub' }, dial);
  el('circle', { r: 3.4, class: 'hub-rim' }, dial);
  el('circle', { r: 1.8, class: 'hub-hole' }, dial);

  return { slideHolder, slideUse, dial, disc, cursor };
}

function drawCursor(g) {
  const half = 13;
  const end = 126;
  const hubR = 21;
  const yJoin = -Math.sqrt(hubR * hubR - half * half);
  el('path', {
    d: `M${-half} ${-end}H${half}V${r3(yJoin)}A${hubR} ${hubR} 0 1 1 ${-half} ${r3(yJoin)}Z`,
    class: 'cursor-arm',
  }, g);
  el('line', { x1: 0, y1: -hubR + 1, x2: 0, y2: -end + 1, class: 'cursor-line' }, g);
  el('line', { x1: 0, y1: -hubR + 1, x2: 0, y2: -end + 1, class: 'hit hit-stroke', 'data-hit': 'calc-cursor' }, g);
}

// ---------------------------------------------------------------------------
// Fixed base: outer scale, datums, conversion scales.

function slideRule(g, outward) {
  const long = [];
  const fine = [];
  for (const t of cs.slideRuleTicks()) {
    const a = cs.valueAngle(t.v);
    const len = TICK[t.kind];
    (t.kind === 'minor' ? fine : long).push(outward ? radial(100, 100 + len, a) : radial(100 - len, 100, a));
  }
  el('path', { d: long.join(''), class: 'tick' }, g);
  el('path', { d: fine.join(''), class: 'tick fine' }, g);
}

function drawOuterScale(g, defs) {
  slideRule(g, true);
  for (const t of cs.slideRuleTicks()) {
    if (t.kind === 'label') radialText(g, String(t.v), 108.7, cs.valueAngle(t.v), { class: t.v === 10 ? 'num index' : 'num' });
  }

  radialText(g, 'TAS', 117.6, cs.valueAngle(37.5), { class: 'red-label big' });

  drawSgScale(g, defs, cs.sgKgValue, cs.SG_RANGE.kg);
  drawSgScale(g, defs, cs.sgLbValue, cs.SG_RANGE.lb);

  for (const d of cs.DATUMS) {
    const a = cs.valueAngle(d.value);
    if (d.onSg) {
      el('path', { d: pointer(SG_LINE + 0.1, SG_LINE + 2.2, a, 0.75), class: 'datum-mark' }, g);
    } else {
      el('path', { d: pointer(111, 112.9, a, 0.55) + radial(112.6, 115.8, a), class: 'datum-arrow' }, g);
    }
    radialText(g, d.label, DATUM_LABEL_R, a, { class: 'datum' });
  }

  drawTempConversion(g);

  arcText(g, defs, 'CRP-5 EMULATOR', 129.6, 0, 6.2, { class: 'brand' });
  arcText(g, defs, 'OPEN SOURCE', 136.2, 0, 2.4, { class: 'brand-sub' });
}

function drawSgScale(g, defs, valueOf, [from, to]) {
  const a0 = cs.valueAngle(valueOf(from));
  const a1 = cs.valueAngle(valueOf(to));
  const ticks = [radial(SG_LINE - 2.2, SG_LINE, a0), radial(SG_LINE - 2.2, SG_LINE, a1)];
  for (let i = Math.round(from * 100); i <= Math.round(to * 100); i++) {
    const a = cs.valueAngle(valueOf(i / 100));
    ticks.push(radial(SG_LINE - (i % 5 === 0 ? 1.9 : 1.1), SG_LINE, a));
    if (i % 5 === 0 && i !== Math.round(cs.SG_REFERENCE * 100)) radialText(g, String(i), 117.2, a, { class: 'num-sg' });
  }
  el('path', { d: arc(SG_LINE, a0, a1) + ticks.join(''), class: 'tick sg' }, g);
  arcText(g, defs, 'Sp.G', 117.6, a0 - 1.4, 4, { class: 'red-label' }, false, 'end');
}

function drawTempConversion(g) {
  const { cFrom, cTo } = cs.TEMP_CONVERSION;
  const line = 132;
  const ticks = [arc(line, cs.tempConversionAngle(cTo), cs.tempConversionAngle(cFrom))];
  for (let c = cFrom; c <= cTo; c++) {
    const a = cs.tempConversionAngle(c);
    ticks.push(radial(line - (c % 10 === 0 ? 2.8 : c % 5 === 0 ? 2.1 : 1.3), line, a));
    if (c % 10 === 0) radialText(g, minus(c), 127.7, a, { class: 'num-cf' }, true);
  }
  for (let f = -58; f <= 122; f++) {
    if (f % 2 && f % 5) continue;
    const a = cs.tempConversionAngle(cs.fToC(f));
    ticks.push(radial(line, line + (f % 10 === 0 ? 2.8 : f % 5 === 0 ? 2.1 : 1.3), a));
    if (f % 10 === 0 && f >= -50) radialText(g, minus(f), 137.1, a, { class: 'num-cf' }, true);
  }
  el('path', { d: ticks.join(''), class: 'tick fine' }, g);
  for (const a of [cs.tempConversionAngle(cFrom) + 4.4, cs.tempConversionAngle(cTo) - 4.4]) {
    radialText(g, '°C', 127.7, a, { class: 'num-cf strong' }, true);
    radialText(g, '°F', 137.1, a, { class: 'num-cf strong' }, true);
  }
}

// ---------------------------------------------------------------------------
// Base scales seen through the disc windows.

function drawBaseScales(g) {
  const W = cs.WINDOWS;

  // Air Speed window: pressure altitude, ticks across the window and numbers
  // along its inner edge, running on up to 80,000 ft; Mach index above.
  const alt = [];
  for (let h = -2000; h <= 80000; h += 1000) {
    const a = cs.airspeedAltAngle(h);
    alt.push(radial(W.airspeed.r0 + 3.4, W.airspeed.r1 - (h % 5000 === 0 ? 0.6 : 1.6), a));
    if (h % 5000 === 0) radialText(g, String(h / 1000), W.airspeed.r0 + 1.7, a, { class: 'num-base' });
  }
  el('path', { d: alt.join(''), class: 'tick fine' }, g);
  const m = cs.MACH_INDEX_ANGLE;
  el('path', { d: pointer(W.airspeed.r1 - 0.3, W.airspeed.r1 - 2.6, m, 1.1) + radial(59.4, W.airspeed.r1 - 2.4, m), class: 'base-arrow' }, g);
  radialText(g, 'Mach No', 63.4, m + 5, { class: 'base-label' });
  radialText(g, 'Index', 61.2, m + 5, { class: 'base-label' });

  // Altitude window: air temperature, numbered every 20 °C plus the ISA tropopause.
  const temp = [];
  for (let t = -80; t <= 50; t++) {
    const a = cs.altitudeTempAngle(t);
    temp.push(radial(W.altitude.r0, W.altitude.r0 + (t % 10 === 0 ? 2.8 : t % 5 === 0 ? 2 : 1.2), a));
    if (t % 20 === 0 && t > -80) radialText(g, signed(t), 54, a, { class: 'num-base' });
  }
  const tropo = cs.altitudeTempAngle(-56.5);
  temp.push(radial(W.altitude.r0, W.altitude.r0 + 3.4, tropo));
  // Printed just clockwise of its tick so it clears the −60 label.
  radialText(g, '−56.5', 54.2, tropo + 3.4, { class: 'num-base small' });
  el('path', { d: temp.join(''), class: 'tick fine' }, g);

  // Comp Corr window: whole divisions, closing up towards sea level (∞).
  const cc = [];
  for (const t of cs.compCorrTicks()) {
    cc.push(radial(W.compCorr.r0, W.compCorr.r0 + (t.labelled ? 2.8 : 1.7), t.angle));
    if (t.labelled) radialText(g, String(t.value), 71.4, t.angle, { class: 'num-base' });
  }
  cc.push(radial(W.compCorr.r0, W.compCorr.r0 + 2.8, W.compCorr.phi));
  radialText(g, '∞', 71.4, W.compCorr.phi, { class: 'num-base' });
  el('path', { d: cc.join(''), class: 'tick fine' }, g);

  // Density Altitude window: −6 to 70 (×1000 ft), then a gap.
  const da = [];
  const [daFrom, daTo] = cs.DENSITY_RANGE;
  for (let h = daFrom; h <= daTo; h += 1000) {
    const a = cs.densityAltAngle(h);
    da.push(radial(W.density.r0, W.density.r0 + (h % 5000 === 0 ? 2.8 : 1.9), a));
    if (h % 5000 === 0) radialText(g, minus(h / 1000), 40.6, a, { class: 'num-base' });
  }
  el('path', { d: da.join(''), class: 'tick fine' }, g);
}

// ---------------------------------------------------------------------------
// Rotating inner disc.

function drawDisc(g, defs) {
  const W = cs.WINDOWS;
  const holes = Object.values(W).map(w => sector(w.r0, w.r1, w.phi - w.half, w.phi + w.half)).join('');
  el('path', { d: circlePath(100) + holes, 'fill-rule': 'evenodd', class: 'disc' }, g);
  el('path', { d: circlePath(100) + circlePath(SCALE_BAND), 'fill-rule': 'evenodd', class: 'scale-ring' }, g);
  el('path', { d: holes, class: 'window-rim' }, g);

  // Inner slide-rule scale.
  slideRule(g, false);
  for (const t of cs.slideRuleTicks()) {
    if (t.kind !== 'label' || t.v === 60) continue;
    radialText(g, String(t.v), 92.3, cs.valueAngle(t.v), { class: t.v === 10 ? 'num index' : 'num' });
  }
  radialText(g, 'MINUTES', 92.3, cs.valueAngle(32.4), { class: 'red-label' });
  radialText(g, 'RAS/CAS', 92.3, cs.valueAngle(37.5), { class: 'red-label' });
  el('circle', { r: 100, class: 'scale-boundary' }, g);

  // ▲60 speed index.
  const a60 = cs.valueAngle(60);
  el('path', { d: pointer(97, 88.4, a60, 3.3), class: 'speed-index' }, g);
  radialText(g, '60', 90.8, a60, { class: 'speed-index-text' });

  drawHours(g);

  // Red index at inner 10 (1.40 on the hours band).
  el('path', { d: radial(60.5, HOURS[0] - 1.6, 0) + pointer(HOURS[0] - 0.2, HOURS[0] - 3.4, 0, 1.6), class: 'red-index' }, g);

  drawAirSpeed(g, defs);
  drawAltitude(g, defs);
  drawCompCorr(g, defs);
  drawDensity(g, defs);
  drawTempRise(g, defs);
}

function drawHours(g) {
  el('path', { d: circlePath(HOURS[1]) + circlePath(HOURS[0]), 'fill-rule': 'evenodd', class: 'hours-band' }, g);
  const ticks = [];
  for (const t of cs.hoursTicks()) {
    const a = cs.valueAngle(t.minutes);
    ticks.push(radial(HOURS[1] - (t.kind === 'label' ? 2.8 : t.kind === 'major' ? 2 : 1.2), HOURS[1], a));
    if (t.kind === 'label') radialText(g, cs.formatHours(t.minutes).replace(':', '.'), 81.4, a, { class: 'num-hours' });
  }
  el('path', { d: ticks.join(''), class: 'tick' }, g);
  radialText(g, 'HOURS', 81.4, cs.valueAngle(13.5), { class: 'red-label' });
}

// COAT scale along one edge of the Air Speed window (ticks run into it).
function coatScale(g, edge, outward, labelR) {
  const a = cs.airspeedCoatAngle;
  const ticks = [];
  for (let t = -80; t <= 50; t += 5) {
    const len = t % 10 === 0 ? 2.8 : 1.8;
    ticks.push(outward ? radial(edge, edge + len, a(t)) : radial(edge - len, edge, a(t)));
  }
  const tropo = a(-56.5);
  ticks.push(outward ? radial(edge, edge + 3.4, tropo) : radial(edge - 3.4, edge, tropo));
  el('path', { d: ticks.join(''), class: 'tick' }, g);
  for (const t of [50, 0, -40, -80]) radialText(g, signed(t), labelR, a(t), { class: 'num-window' });
  // Staggered away from −40, as on the real disc.
  radialText(g, '−56.5', outward ? labelR + 0.2 : labelR - 2.6, tropo, { class: 'num-window small' });
}

function drawAirSpeed(g, defs) {
  const w = cs.WINDOWS.airspeed;
  coatScale(g, w.r1, true, 71.4);
  coatScale(g, w.r0, false, 52.5);
  const start = w.phi - w.half - 2.8;
  const end = cs.airspeedCoatAngle(-80) + 3.4;
  arcText(g, defs, 'Air Temp °C', 71.4, start, 2.9, { class: 'disc-label' }, false, 'end');
  arcText(g, defs, 'Mach No or Press Alt × 1000ft', 61.8, start, 2.9, { class: 'disc-label' }, false, 'end');
  arcText(g, defs, 'Air Temp °C', 52.5, start - 1.4, 2.9, { class: 'disc-label' }, false, 'end');
  arcText(g, defs, '°C', 71.4, end, 2.9, { class: 'disc-label' }, false, 'start');
  arcText(g, defs, '°C', 52.5, end, 2.9, { class: 'disc-label' }, false, 'start');
  arcText(g, defs, 'AIR SPEED', 45.4, w.phi, 4.4, { class: 'window-title' });

  // Instruction box, sized to fit its two lines of text.
  const lines = [['COMPUTE TAS FROM', 35.2], ['MACH No OR CAS', 30.8]];
  const box = el('path', { class: 'note-box' }, g);
  let halfSpan = 0;
  for (const [text, r] of lines) {
    const t = arcText(g, defs, text, r, w.phi, 2.3, { class: 'note-text' });
    const length = t.getComputedTextLength?.() || text.length * 2.3 * 0.62;
    halfSpan = Math.max(halfSpan, (length / r) * (90 / Math.PI));
  }
  halfSpan += 3.5;
  box.setAttribute('d', sector(27.6, 38.8, w.phi - halfSpan, w.phi + halfSpan));
}

function drawAltitude(g, defs) {
  const w = cs.WINDOWS.altitude;
  const ticks = [];
  for (let h = 0; h <= 36000; h += 1000) {
    const a = cs.altitudeAltAngle(h);
    const len = h % 10000 === 0 ? 3 : h % 5000 === 0 ? 2.2 : 1.3;
    ticks.push(radial(w.r0 - len, w.r0, a));
    if (h % 10000 === 0) radialText(g, String(h / 1000), 44.5, a, { class: 'num-window' });
  }
  el('path', { d: ticks.join(''), class: 'tick fine' }, g);
  const start = w.phi - w.half - 2.8;
  arcText(g, defs, 'Air Temp °C', 53.9, start, 2.9, { class: 'disc-label' }, false, 'end');
  arcText(g, defs, 'Press Alt × 1000ft', 44.5, start, 2.9, { class: 'disc-label' }, false, 'end');
  arcText(g, defs, 'ALTITUDE', 38.4, w.phi, 4.4, { class: 'window-title' });
}

// Small arrowhead lying along a circle, pointing clockwise (dir 1) or anticlockwise (-1).
function arrowhead(r, a, dir) {
  const back = a - dir * 2.2;
  const [tx, ty] = polar(r, a);
  const [lx, ly] = polar(r - 0.9, back);
  const [rx, ry] = polar(r + 0.9, back);
  return `M${r3(tx)} ${r3(ty)}L${r3(lx)} ${r3(ly)}L${r3(rx)} ${r3(ry)}Z`;
}

function drawCompCorr(g, defs) {
  const w = cs.WINDOWS.compCorr;
  el('path', { d: radial(57.6, w.r0 - 2.6, w.phi) + pointer(w.r0 + 0.6, w.r0 - 2.8, w.phi, 1.5), class: 'black-arrow' }, g);
  // "TAS/100 − 3 DIV" written as a fraction, clockwise of the arrow.
  radialText(g, 'TAS', 63.6, w.phi + 5.4, { class: 'formula' });
  el('path', { d: arc(61.9, w.phi + 2.8, w.phi + 8), class: 'fraction-bar' }, g);
  radialText(g, '100', 60.2, w.phi + 5.4, { class: 'formula' });
  arcText(g, defs, '−3 DIV', 61.9, w.phi + 9, 2.9, { class: 'formula' }, false, 'start');
  // Which way to move the disc: anticlockwise.
  el('path', { d: arc(64.2, w.phi - 2.4, w.phi - 5.4), class: 'black-arrow line' }, g);
  el('path', { d: arrowhead(64.2, w.phi - 7.6, -1), class: 'black-arrow' }, g);
  arcText(g, defs, 'COMP. CORR.', 52.6, w.phi + 5, 3.8, { class: 'window-title' });
}

function drawDensity(g, defs) {
  const w = cs.WINDOWS.density;
  el('path', { d: radial(27.4, w.r0 - 2.6, w.phi) + pointer(w.r0 + 0.6, w.r0 - 2.8, w.phi, 2.2), class: 'black-arrow' }, g);
  arcText(g, defs, 'DENSITY', 31.4, w.phi - 2.4, 3.6, { class: 'window-title' }, false, 'end');
  arcText(g, defs, 'ALTITUDE', 31.4, w.phi + 2.4, 3.6, { class: 'window-title' }, false, 'start');
  arcText(g, defs, '×1000ft', 24.6, w.phi, 2.7, { class: 'disc-label' });
}

function drawTempRise(g, defs) {
  const { tasFrom, tasTo } = cs.TEMP_RISE;
  const [aStart, aStep, aEnd] = [140, 204, 255];
  const [rOuter, rNarrow, rWide] = [74.6, 59.5, 51];
  const [px, py] = polar(rWide, aEnd);
  const [qx, qy] = polar(rNarrow, aStep);
  el('path', {
    d: `${arc(rOuter, aStart, aEnd)}L${r3(px)} ${r3(py)}${arc(rWide, aEnd, aStep, false)}L${r3(qx)} ${r3(qy)}${arc(rNarrow, aStep, aStart, false)}Z`,
    class: 'temprise-band',
  }, g);

  const line = 67;
  const ticks = [arc(line, cs.tempRiseAngle(cs.tasForTempRise(1)), cs.tempRiseAngle(tasTo))];
  // Graduated as finely as the real scale: TAS every 10 kt to 200 then every
  // 20 kt; temperature rise every 1 °C to 20, every 2 °C to 50, every 5 °C to 100.
  for (let tas = tasFrom; tas <= tasTo; tas += tas < 200 ? 10 : 20) {
    const a = cs.tempRiseAngle(tas);
    ticks.push(radial(line, line + (tas % 100 === 0 ? 2.4 : tas % 50 === 0 ? 1.7 : 1.1), a));
    if (tas % 100 === 0) radialText(g, String(tas), 70.9, a, { class: 'num-temprise' });
  }
  const labelled = [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 100];
  for (let rise = 1; rise <= 100; rise += rise < 20 ? 1 : rise < 50 ? 2 : 5) {
    const a = cs.tempRiseAngle(cs.tasForTempRise(rise));
    ticks.push(radial(line - (labelled.includes(rise) ? 2.4 : rise % 5 === 0 ? 1.7 : 1.1), line, a));
    if (labelled.includes(rise)) radialText(g, String(rise), 63.1, a, { class: 'num-temprise' });
  }
  el('path', { d: ticks.join(''), class: 'tick temprise' }, g);
  const a100 = cs.tempRiseAngle(tasFrom);
  arcText(g, defs, 'Kts', 70.9, a100 - 2.4, 2.4, { class: 'temprise-label' }, false, 'end');
  arcText(g, defs, 'TAS', 70.9, a100 + 2.4, 2.4, { class: 'temprise-label' }, false, 'start');
  arcText(g, defs, '°C', 63.1, a100 - 3.4, 2.4, { class: 'temprise-label' }, false, 'end');
  arcText(g, defs, 'TEMP. RISE', 55.2, 217, 2.6, { class: 'temprise-label strong' });
}
