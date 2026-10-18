import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cs from '../js/calcscales.js';
import * as atm from '../js/atmosphere.js';

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label ?? ''} expected ${expected} ± ${tolerance}, got ${actual}`);

// Outer value opposite an inner value, for a disc rotation θ.
const outerOpposite = (inner, theta) => cs.mantissaAt(cs.valueAngle(inner) + theta);

test('log scale: 10 at the top, one decade per turn', () => {
  near(cs.valueAngle(10), 0, 1e-9);
  near(cs.valueAngle(100), 0, 1e-9);
  near(cs.valueAngle(Math.sqrt(1000)), 180, 1e-9);
  near(cs.mantissaAt(cs.valueAngle(47.3)), 47.3, 1e-9);
});

test('graduations follow the real spacing', () => {
  const ticks = cs.slideRuleTicks();
  const values = ticks.map(t => t.v);
  assert.ok(values.includes(10.1) && values.includes(14.9), '0.1 steps below 15');
  assert.ok(values.includes(15.2) && !values.includes(15.1), '0.2 steps from 15 to 30');
  assert.ok(values.includes(30.5) && !values.includes(30.2), '0.5 steps from 30');
  const labels = ticks.filter(t => t.kind === 'label').map(t => t.v);
  assert.deepEqual(labels.slice(0, 3), [10, 11, 12]);
  assert.ok(labels.includes(30) && labels.includes(35) && !labels.includes(31));
});

test('ratio: GS 178 kt, 124 NM takes 41.8 min', () => {
  const theta = cs.rotationFor(60, 178);
  // inner opposite outer 124
  const inner = cs.mantissaAt(cs.valueAngle(124) - theta);
  near(inner, 41.8, 0.05);
});

test('datums: km → NM and statute miles', () => {
  const theta = cs.rotationFor(26.5, 10); // 2650 km against the KM datum
  const datum = id => cs.DATUMS.find(d => d.id === id).value;
  near(cs.mantissaAt(cs.valueAngle(datum('nm')) - theta), 14.31, 0.01, 'NM');
  near(cs.mantissaAt(cs.valueAngle(datum('sm')) - theta), 16.47, 0.01, 'statute miles');
});

test('datums: volume to mass with specific gravity', () => {
  const datum = id => cs.DATUMS.find(d => d.id === id).value;
  const theta = cs.rotationFor(12.5, datum('km')); // 1,250 L
  near(cs.mantissaAt(cs.valueAngle(cs.sgKgValue(0.79)) - theta), 98.75, 0.01, 'kg');
  near(cs.mantissaAt(cs.valueAngle(cs.sgLbValue(0.79)) - theta), 21.77, 0.01, 'lb');
  near(cs.mantissaAt(cs.valueAngle(datum('imp')) - theta), 27.50, 0.01, 'imp gal');
});

test('Air Speed window reproduces TAS = CAS/√σ for any altitude and COAT', () => {
  for (const h of [0, 8000, 18000, 30000, 45000]) {
    for (const t of [-60, -30, 0, 30]) {
      const theta = cs.mod360(cs.airspeedAltAngle(h) - cs.airspeedCoatAngle(t));
      near(outerOpposite(17, theta) * 10, atm.tasIncompressible(170, h, atm.cToK(t)), 1e-6, `${h} ft ${t} °C`);
    }
  }
});

test('Mach index gives TAS opposite Mach number', () => {
  for (const t of [-56, -45, -20, 15]) {
    const theta = cs.mod360(cs.MACH_INDEX_ANGLE - cs.airspeedCoatAngle(t));
    near(outerOpposite(82, theta) * 10, 0.82 * atm.speedOfSoundKt(atm.cToK(t)), 1e-6, `${t} °C`);
    near(cs.coatAtMachIndex(theta), t, 1e-9);
  }
});

test('Altitude window: 20,000 ft at −35 °C reads about 19,170 ft true', () => {
  const theta = cs.altitudeTempAngle(-35) - cs.altitudeAltAngle(20000);
  near(outerOpposite(20, theta) * 1000, 20000 * atm.cToK(-35) / atm.isaTempK(20000), 1e-6);
  near(outerOpposite(20, theta) * 1000, 19165, 5);
});

test('Density Altitude window: 5,000 ft at +30 °C reads about 7,800 ft', () => {
  const theta = cs.mod360(cs.airspeedAltAngle(5000) - cs.airspeedCoatAngle(30));
  near(cs.densityAltitudeFor(theta), 7801, 5);
  near(cs.densityAltAngle(cs.densityAltitudeFor(theta)) - cs.WINDOWS.density.phi, theta, 1e-6);
});

test('Comp Corr: zero under the arrow with inner 21.75 against outer 10 (as photographed)', () => {
  near(cs.compCorrAt(cs.rotationFor(21.75, 10)), 0, 0.01);
  assert.ok(Number.isNaN(cs.compCorrAt(cs.rotationFor(15.3, 10))), 'blank beyond the zero');
});

test('Comp Corr numbering: 35,000 ft at −47 °C reads 38.2', () => {
  const theta = cs.mod360(cs.airspeedAltAngle(35000) - cs.airspeedCoatAngle(-47));
  near(cs.compCorrAt(theta), 38.2, 0.01);
});

test('Comp Corr division size matches the real scale', () => {
  const fl350 = cs.mod360(cs.airspeedAltAngle(35000) - cs.airspeedCoatAngle(-47));
  near(cs.compCorrDivision(fl350), 3.2, 0.1, 'about 3.2° at FL350');
  near(cs.compCorrDivision(cs.rotationFor(21.75, 10) - 0.5), 4.1, 0.1, 'about 4.1° next to the zero');
});

test('Comp Corr training example: TAS 500 from CAS 280, two divisions gives 480', () => {
  const theta = 360 * Math.log10(500 / 280);
  const moved = cs.compCorrTheta(cs.compCorrAt(theta) + 2);
  near(280 * 10 ** (moved / 360), 480, 2);
});

test('Comp Corr rule stays within 2.5% of the exact TAS', () => {
  const cases = [[35000, -47, 280], [35000, -54, 280], [31000, -45, 290], [25000, -35, 300],
    [20000, -25, 320], [39000, -56, 250], [15000, -15, 330], [41000, -50, 240], [10000, -5, 350]];
  for (const [h, t, cas] of cases) {
    const theta = cs.mod360(cs.airspeedAltAngle(h) - cs.airspeedCoatAngle(t));
    const tas0 = cas * 10 ** (theta / 360);
    const moved = cs.compCorrTheta(cs.compCorrAt(theta) + (tas0 / 100 - 3));
    const tas = cas * 10 ** (moved / 360);
    const exact = atm.tasCompressible(cas, h, atm.cToK(t));
    assert.ok(Math.abs(tas - exact) / exact < 0.025, `${h} ft ${t} °C CAS ${cas}: ${tas.toFixed(1)} vs ${exact.toFixed(1)}`);
  }
});

test('Density Altitude scale matches the real one at the top end (as photographed)', () => {
  near(cs.densityAltitudeFor(cs.rotationFor(21.75, 10)), 64700, 50, 'inner 21.75 against outer 10');
  near(cs.densityAltitudeFor(289), 69750, 300, 'just short of 70 at about 289°');
  near(cs.densityTheta(65000) - cs.densityTheta(64000), 10, 0.5, '1,000 ft divisions about 10° apart');
});

test('Density Altitude scale runs from −6 to 70 with a gap between', () => {
  const [from, to] = cs.DENSITY_RANGE;
  assert.equal(from, -6000);
  assert.equal(to, 70000);
  assert.ok(Number.isNaN(cs.densityAltitudeFor(320)), 'gap between 70 and −6');
  near(cs.densityAltitudeFor(cs.densityTheta(-6000) + 1e-6), -6000, 5);
  let previous = -Infinity;
  for (let h = from; h <= to; h += 250) {
    const t = cs.densityTheta(h);
    assert.ok(t > previous, `monotone at ${h}`);
    previous = t;
  }
});

test('Comp Corr numbers increase anticlockwise', () => {
  const ticks = cs.compCorrTicks();
  for (let i = 1; i < ticks.length; i++) assert.ok(ticks[i].angle < ticks[i - 1].angle);
});

test('hours ring', () => {
  assert.equal(cs.formatHours(274), '4:34');
  assert.equal(cs.formatHours(cs.hoursForMantissa(27.4)), '4:34');
  assert.equal(cs.formatHours(cs.hoursForMantissa(90)), '1:30');
});
