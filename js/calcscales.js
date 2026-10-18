// Geometry of the calculator (circular slide rule) side.
//
// Angles are degrees clockwise from 12 o'clock, in "dial units" where the
// rotating inner disc has radius 100. The disc rotation θ is how far the disc
// has been turned clockwise from "10 against 10": an inner value v then sits
// against the outer value v × 10^(θ/360).
//
// Every window scale below is derived from that one relationship, so the
// windows, the slide rule and the readouts can never disagree.

import * as atm from './atmosphere.js';

const log10 = Math.log10;

export const mod360 = a => ((a % 360) + 360) % 360;
export const wrap180 = a => {
  const m = mod360(a);
  return m > 180 ? m - 360 : m;
};

/** Angle of a value on a one-decade log scale (10 at the top). */
export function valueAngle(v) {
  const l = log10(v);
  return 360 * (l - Math.floor(l));
}

/** Scale reading (10 ≤ x < 100) at an angle. */
export function mantissaAt(angle) {
  return 10 * 10 ** (mod360(angle) / 360);
}

/** Disc rotation that sets `inner` against `outer`. */
export function rotationFor(inner, outer) {
  return mod360(valueAngle(outer) - valueAngle(inner));
}

// ---------------------------------------------------------------------------
// Slide-rule graduations
//   10–15: every 0.1, a longer mark every 0.5
//   15–30: every 0.2
//   30–100: every 0.5
// Whole numbers are numbered up to 30, then every fifth whole number.

export function slideRuleTicks() {
  const ticks = [];
  for (let t = 100; t < 1000; t++) {
    const v = t / 10;
    if (v >= 15 && v < 30 && t % 2) continue;
    if (v >= 30 && t % 5) continue;
    let kind = 'minor';
    if (t % 10 === 0) kind = v <= 30 || v % 5 === 0 ? 'label' : 'major';
    else if (v < 15 && t % 5 === 0) kind = 'mid';
    ticks.push({ v, kind });
  }
  return ticks;
}

// Minutes → hours ring on the inner disc (aligned with the inner scale).
export const HOURS_LABELS = [60, 70, 80, 90, 100, 110, 120, 150, 180, 210, 240, 270, 300, 360, 420, 480, 540];

export function hoursTicks() {
  const ticks = [];
  for (let m = 60; m < 600; m++) {
    const step = m < 120 ? 2 : m < 300 ? 5 : 10;
    if (m % step) continue;
    const kind = HOURS_LABELS.includes(m) ? 'label' : m % 10 === 0 ? 'major' : 'minor';
    ticks.push({ minutes: m, kind });
  }
  return ticks;
}

export function formatHours(minutes) {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total - 60 * h;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Hours-ring reading for an inner-scale mantissa (covers 60–600 minutes). */
export function hoursForMantissa(v) {
  return v < 60 ? v * 10 : v;
}

// ---------------------------------------------------------------------------
// Unit conversion datums printed in red around the outer scale. Set a
// quantity on the inner scale against its unit's datum and read the same
// quantity in other units on the inner scale against their datums.

export const LB_PER_KG = 2.204623;
export const SG_REFERENCE = 0.8;        // where the plain KGS / LBS datums sit
export const SG_RANGE = { kg: [0.7, 0.9], lb: [0.7, 0.95] };

export const sgKgValue = sg => 100 * sg;
export const sgLbValue = sg => 10 * sg * LB_PER_KG;

export const DATUMS = [
  { id: 'km', label: 'KM-M-LTR', value: 10 },
  { id: 'yd', label: 'Yards', value: 10 * 1.0936133 },
  { id: 'lb', label: 'lbs', value: sgLbValue(SG_REFERENCE), onSg: true },
  { id: 'imp', label: 'Imp.Gal', value: 10 / 4.54609 },
  { id: 'usg', label: 'US.Gal', value: 10 / 3.785412 },
  { id: 'ms', label: 'M/Sec', value: 10 / 3.6 },
  { id: 'ft', label: 'Feet', value: 10 / 0.3048 },
  { id: 'nm', label: 'Naut.M', value: 10 / 1.852 },
  { id: 'sm', label: 'Stat.M', value: 10 / 1.609344 },
  { id: 'kg', label: 'KGS', value: sgKgValue(SG_REFERENCE), onSg: true },
];

// ---------------------------------------------------------------------------
// Windows cut in the inner disc. Each shows a scale printed on the fixed base
// beneath, read against a scale or arrow printed on the disc beside it.
//   phi  – disc angle of the window centre   half – half its angular width
//   r0,r1 – radial extent

export const WINDOWS = {
  airspeed: { phi: 85, half: 22, r0: 57.5, r1: 66 },
  altitude: { phi: 0, half: 24, r0: 49.5, r1: 56.5 },
  compCorr: { phi: 268, half: 9, r0: 66.5, r1: 74.5 },
  density: { phi: 180, half: 12, r0: 36, r1: 45 },
};

export const COAT_RANGE = [-80, 50];

// Air Speed window. TAS/CAS = 1/√σ = √((p0/p)(T/T0)), so the disc carries
// half-log temperature (COAT, increasing anticlockwise) and the base carries
// half-log pressure ratio (pressure altitude).
const AS_TMID = Math.sqrt(atm.cToK(COAT_RANGE[0]) * atm.cToK(COAT_RANGE[1]));

export const airspeedCoatAngle = tC =>
  WINDOWS.airspeed.phi - 180 * log10(atm.cToK(tC) / AS_TMID);

export const airspeedAltAngle = h =>
  WINDOWS.airspeed.phi + 180 * log10(AS_TMID / atm.T0) - 180 * log10(atm.pressureRatio(h));

// Mach number index, on the base in the Air Speed window. Against a COAT it
// sets TAS (outer) opposite Mach number (inner): TAS = M · 38.97 · √T.
export const MACH_INDEX_ANGLE = mod360(
  WINDOWS.airspeed.phi + 360 * log10(atm.A0_KT / Math.sqrt(atm.T0)) + 180 * log10(AS_TMID),
);

/** COAT on the disc that is aligned with the Mach index for a rotation θ. */
export function coatAtMachIndex(theta) {
  const offset = wrap180(MACH_INDEX_ANGLE - theta - WINDOWS.airspeed.phi);
  return atm.kToC(AS_TMID * 10 ** (-offset / 180));
}

// Altitude window: true/indicated altitude = T / T_ISA(pressure altitude).
// Pressure altitude is on the disc edge, air temperature in the window.
const ALT_TC = Math.sqrt(atm.T0 * atm.T_TROP);

export const altitudeAltAngle = h =>
  WINDOWS.altitude.phi + 360 * log10(atm.isaTempK(h) / ALT_TC);

export const altitudeTempAngle = tC =>
  WINDOWS.altitude.phi + 360 * log10(atm.cToK(tC) / ALT_TC);

// Density Altitude window: read-only, against an arrow on the disc. The disc
// rotation set in the Air Speed window is θ = 180·log10(1/σ), so up to the
// tropopause the scale is ISA density altitude. Above it the real scale opens
// out: with inner 21.75 against outer 10 it reads about 64,700 ft, and its
// 1,000 ft divisions are about 10° apart there, reaching 70 at about 290°
// (both seen in photographs). Then comes a gap and the start of the scale
// at −6. A monotone cubic carries the ISA scale smoothly into that section.
export const DENSITY_RANGE = [-6000, 70000];
const DA_TOP = { h: 64700, theta: rotationFor(21.75, 10), slope: 10 / 1000 };

const isaDensityTheta = h => -180 * log10(atm.isaDensityRatio(h));
const DA_JOIN = { h: atm.H_TROP, theta: isaDensityTheta(atm.H_TROP), slope: isaDensityTheta(atm.H_TROP + 1) - isaDensityTheta(atm.H_TROP) };

/** Disc rotation at which the Density Altitude arrow points at altitude h. */
export function densityTheta(h) {
  if (h <= DA_JOIN.h) return isaDensityTheta(h);
  if (h >= DA_TOP.h) return DA_TOP.theta + (h - DA_TOP.h) * DA_TOP.slope;
  const span = DA_TOP.h - DA_JOIN.h;
  const t = (h - DA_JOIN.h) / span;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * DA_JOIN.theta + (t3 - 2 * t2 + t) * DA_JOIN.slope * span
    + (-2 * t3 + 3 * t2) * DA_TOP.theta + (t3 - t2) * DA_TOP.slope * span;
}

export const densityAltAngle = h => WINDOWS.density.phi + densityTheta(h);

/** Density altitude under the arrow for disc rotation θ (NaN in the gap). */
export function densityAltitudeFor(theta) {
  const [from, to] = DENSITY_RANGE;
  const lo = densityTheta(from);
  const hi = densityTheta(to);
  let t = mod360(theta);
  if (t > hi) t -= 360;
  if (t < lo || t > hi) return NaN;
  let a = from;
  let b = to;
  for (let i = 0; i < 60; i++) {
    const mid = (a + b) / 2;
    if (densityTheta(mid) < t) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

// ---------------------------------------------------------------------------
// Compressibility correction ("Comp Corr") window.
//
// Above about 300 kt the slide-rule TAS (from CAS with no compressibility
// allowance) reads high. The rule is to move the disc anticlockwise by
// TAS/100 − 3 divisions of the scale in this window. The numbers count
// divisions: they increase anticlockwise, run off to infinity towards sea
// level, and stop at 0.
//
// The shape of the scale (how division size changes with altitude) comes
// from the compressible-flow equations: at each disc setting, taken as ISA at
// that density, the least-squares fit of the rule over 350–650 kt. It is then
// fitted to two points read from the real instrument:
//   – 0 under the arrow with inner 21.75 against outer 10 (from a photograph);
//   – 38.2 at pressure altitude 35,000 ft with COAT −47 °C (from the common
//     training example).
// The real divisions come out at 0.70 of the physics fit: about 3.2° at
// FL350 and 4.1° next to the 0, which also matches both sources.

const CC_STEP = 0.05;
const CC_FROM = 0.4;
const CC_ZERO = rotationFor(21.75, 10);
const CC_ANCHOR = { theta: -180 * log10(atm.densityRatio(35000, atm.cToK(-47))), value: 38.2 };

function physicsDivision(theta) {
  const ratio = 10 ** (theta / 360);
  const h = atm.densityAltitude(1 / (ratio * ratio));
  const tK = atm.isaTempK(h);
  let num = 0;
  let den = 0;
  for (let tas = 350; tas <= 650; tas += 25) {
    const n = tas / 100 - 3;
    const mach = atm.machFromCas(tas / ratio, h);
    if (!(mach < 1)) continue;
    num += n * 360 * log10(tas / (mach * atm.speedOfSoundKt(tK)));
    den += n * n;
  }
  return num / den;
}

function buildCompCorr() {
  const count = Math.floor((CC_ZERO - CC_FROM) / CC_STEP);
  const thetas = [];
  const physics = [];
  for (let i = 0; i <= count; i++) {
    const theta = i === count ? CC_ZERO : CC_FROM + i * CC_STEP;
    thetas.push(theta);
    physics.push(physicsDivision(theta));
  }
  // Divisions counted back from the zero, in units of the physics fit.
  const raw = new Array(thetas.length);
  raw[raw.length - 1] = 0;
  for (let i = raw.length - 2; i >= 0; i--) {
    raw[i] = raw[i + 1] + (thetas[i + 1] - thetas[i]) * 0.5 * (1 / physics[i] + 1 / physics[i + 1]);
  }
  const scale = interpolate(thetas, raw, CC_ANCHOR.theta) / CC_ANCHOR.value;
  return {
    thetas,
    perDivision: physics.map(d => d * scale),
    values: raw.map(v => v / scale),
  };
}

function interpolate(xs, ys, x) {
  const last = xs[xs.length - 1];
  if (Math.abs(x - last) < 1e-9) x = last;
  if (!(x >= xs[0] && x <= last)) return NaN;
  let i = Math.min(xs.length - 2, Math.floor((x - xs[0]) / (xs[1] - xs[0])));
  while (i > 0 && xs[i] > x) i--;
  const f = (x - xs[i]) / (xs[i + 1] - xs[i]);
  return ys[i] + f * (ys[i + 1] - ys[i]);
}

const CC = buildCompCorr();

/** Comp Corr scale reading against the arrow for disc rotation θ (NaN if none). */
export function compCorrAt(theta) {
  return interpolate(CC.thetas, CC.values, mod360(theta));
}

/** Degrees of disc rotation per Comp Corr division at rotation θ. */
export function compCorrDivision(theta) {
  return interpolate(CC.thetas, CC.perDivision, mod360(theta));
}

/** Disc rotation at which the arrow points at Comp Corr value `value`. */
export function compCorrTheta(value) {
  // values fall as θ rises
  const { thetas, values } = CC;
  if (value > values[0] || value < values[values.length - 1]) return NaN;
  let lo = 0;
  let hi = values.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (values[mid] > value) lo = mid;
    else hi = mid;
  }
  const f = (values[lo] - value) / (values[lo] - values[hi]);
  return thetas[lo] + f * (thetas[hi] - thetas[lo]);
}

/** Graduations for the base scale: whole divisions, numbered where room allows. */
export function compCorrTicks(minSpacing = 0.28, labelSpacing = 3.6) {
  const ticks = [];
  const top = Math.floor(CC.values[0]);
  const bottom = Math.ceil(CC.values[CC.values.length - 1]);
  for (let value = bottom; value <= top; value++) {
    const theta = compCorrTheta(value);
    const spacing = compCorrDivision(theta);
    if (!(spacing >= minSpacing)) continue;
    const step = [2, 10, 20].find(s => s * spacing >= labelSpacing) ?? 50;
    ticks.push({ value, angle: WINDOWS.compCorr.phi + theta, labelled: value % step === 0 });
  }
  return ticks;
}

// ---------------------------------------------------------------------------
// Temperature rise scale (kinetic heating of the probe), printed on the disc.
// Log–log: TAS 100–1000 kt on one side, the rise in °C (∝ TAS²) on the other.

export const TEMP_RISE = { a0: 149, perDecade: 102, tasFrom: 100, tasTo: 1000 };

export const tempRiseAngle = tas => TEMP_RISE.a0 + TEMP_RISE.perDecade * log10(tas / TEMP_RISE.tasFrom);

export const tasForTempRise = riseC => Math.sqrt(riseC / atm.ramRiseC(1));

// ---------------------------------------------------------------------------
// °C / °F conversion arc along the bottom of the fixed body.

export const TEMP_CONVERSION = { a0: 232, a1: 128, cFrom: -50, cTo: 50 };

export const tempConversionAngle = c =>
  TEMP_CONVERSION.a0 + (c - TEMP_CONVERSION.cFrom) * (TEMP_CONVERSION.a1 - TEMP_CONVERSION.a0) / (TEMP_CONVERSION.cTo - TEMP_CONVERSION.cFrom);

export const fToC = f => (f - 32) * 5 / 9;
