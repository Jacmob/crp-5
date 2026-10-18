// International Standard Atmosphere and the airspeed relations the
// calculator-side scales are laid out from. Units: feet, knots, kelvin.

export const T0 = 288.15;               // ISA sea-level temperature, K
export const LAPSE_PER_FT = 0.0019812;  // 6.5 K/km
export const H_TROP = 36089.24;         // tropopause, ft (11 km)
export const T_TROP = 216.65;           // K
export const A0_KT = 661.4786;          // speed of sound at T0, kt

const EXPONENT = 5.255876;              // g / (R · lapse rate)
const DELTA_TROP = Math.pow(T_TROP / T0, EXPONENT);
const SCALE_HEIGHT_FT = 20805.8;        // R · T_TROP / g, in feet
const CP = 1004.7;                      // J/(kg·K)
const MS_PER_KT = 0.514444;

export const cToK = c => c + 273.15;
export const kToC = k => k - 273.15;

export function isaTempK(h) {
  return h <= H_TROP ? T0 - LAPSE_PER_FT * h : T_TROP;
}

/** Pressure ratio p/p0 at pressure altitude h. */
export function pressureRatio(h) {
  if (h <= H_TROP) return Math.pow(isaTempK(h) / T0, EXPONENT);
  return DELTA_TROP * Math.exp(-(h - H_TROP) / SCALE_HEIGHT_FT);
}

/** Density ratio at pressure altitude h with air temperature tK. */
export function densityRatio(h, tK) {
  return pressureRatio(h) * T0 / tK;
}

export function isaDensityRatio(h) {
  return densityRatio(h, isaTempK(h));
}

// Altitude at which a ratio that falls with height reaches `target`.
function solveAltitude(ratioAt, target) {
  let lo = -100000;
  let hi = 120000;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (ratioAt(mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const densityAltitude = sigma => solveAltitude(isaDensityRatio, sigma);
export const pressureAltitude = delta => solveAltitude(pressureRatio, delta);

export function speedOfSoundKt(tK) {
  return A0_KT * Math.sqrt(tK / T0);
}

/** TAS from CAS ignoring compressibility: what a slide rule computes. */
export function tasIncompressible(cas, h, tK) {
  return cas / Math.sqrt(densityRatio(h, tK));
}

/** Mach number for a calibrated airspeed at pressure altitude h (subsonic). */
export function machFromCas(cas, h) {
  const qcOverP0 = Math.pow(1 + 0.2 * (cas / A0_KT) ** 2, 3.5) - 1;
  const qcOverP = qcOverP0 / pressureRatio(h);
  return Math.sqrt(5 * (Math.pow(qcOverP + 1, 2 / 7) - 1));
}

export function tasCompressible(cas, h, tK) {
  return machFromCas(cas, h) * speedOfSoundKt(tK);
}

/** Kinetic heating of a temperature probe, in °C, for a given TAS. */
export function ramRiseC(tas, recovery = 0.8) {
  const v = tas * MS_PER_KT;
  return recovery * v * v / (2 * CP);
}
