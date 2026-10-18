import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as atm from '../js/atmosphere.js';

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label ?? ''} expected ${expected} ± ${tolerance}, got ${actual}`);

test('ISA pressure ratio matches standard tables', () => {
  near(atm.pressureRatio(0), 1, 1e-12);
  near(atm.pressureRatio(10000), 0.6877, 0.0005, '10,000 ft');
  near(atm.pressureRatio(atm.H_TROP), 0.2234, 0.0005, 'tropopause');
  near(atm.pressureRatio(50000), 0.1145, 0.0005, '50,000 ft');
});

test('pressure ratio is continuous across the tropopause', () => {
  near(atm.pressureRatio(atm.H_TROP - 0.01), atm.pressureRatio(atm.H_TROP + 0.01), 1e-6);
});

test('density altitude inverts the ISA density ratio', () => {
  for (const h of [-1000, 0, 5000, 20000, 40000]) {
    near(atm.densityAltitude(atm.isaDensityRatio(h)), h, 0.5, `h=${h}`);
  }
});

test('TAS from CAS (incompressible) – 18,000 ft, −30 °C, 170 kt', () => {
  near(atm.tasIncompressible(170, 18000, atm.cToK(-30)), 221, 1);
});

test('speed of sound and Mach – −45 °C, M 0.82', () => {
  const a = atm.speedOfSoundKt(atm.cToK(-45));
  near(a, 588.6, 0.5);
  near(0.82 * a, 482.6, 0.5);
});

test('compressible TAS – 35,000 ft, −47 °C, CAS 280 kt', () => {
  near(atm.tasCompressible(280, 35000, atm.cToK(-47)), 481.3, 0.5);
});

test('compressible and incompressible TAS agree at low speed', () => {
  near(atm.tasCompressible(60, 0, atm.T0), 60, 0.01);
});

test('ram temperature rise – about 9 °C at 297 kt', () => {
  near(atm.ramRiseC(297), 9.3, 0.1);
});
