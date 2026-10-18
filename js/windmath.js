// Geometry of the wind (triangle of velocities) side.
//
// Units are "slide units": one knot on the L face of the slide. The rotating
// window disc has radius 75 with the centre dot at (0, 0); x is to the right
// and y is down the screen.
//
// The slide is a rectangle 160 wide and 370 long. A point on it is given by
// v, its distance from the slide's top edge. Speed arcs are circles about an
// origin (zero speed) below the arcs, with radius proportional to speed, and
// drift lines radiate from that origin, so the vector geometry is exact.

const RAD = Math.PI / 180;

export const mod360 = a => ((a % 360) + 360) % 360;

export const WINDOW_RADIUS = 75;

export const SLIDE = { halfWidth: 80, length: 370 };

export const FACES = {
  // Low speed: arcs 40–300 kt, 1 unit per kt, with a square grid at the bottom.
  L: {
    id: 'L', unit: 1, min: 40, max: 300, topV: 10, gridTopV: 280,
    arcStep: 2, arcBold: 10, arcLabel: 10, oneDegreeFrom: 100, driftMax: 60,
    gridStep: 2, gridBoldEvery: 5, gridLabelEvery: 5,
    driftLabelArcs: [55, 85, 125, 175, 225, 275],
  },
  // High speed: arcs 150–1000 kt at 3/8 of the L scale.
  H: {
    id: 'H', unit: 0.375, min: 150, max: 1000, topV: 12, gridTopV: 337,
    arcStep: 10, arcBold: 50, arcLabel: 50, oneDegreeFrom: 300, driftMax: 60,
    gridStep: 3.75, gridBoldEvery: 5, gridLabelEvery: 5,
    driftLabelArcs: [185, 335, 485, 635, 785, 935],
  },
};

export const otherFace = id => (id === 'L' ? 'H' : 'L');

/** v of the speed-arc origin (zero speed) on a face. */
export const originV = face => face.topV + face.max * face.unit;
export const speedToV = (face, speed) => originV(face) - speed * face.unit;
export const vToSpeed = (face, v) => (originV(face) - v) / face.unit;

export const clampSlideV = v => Math.min(SLIDE.length - 4, Math.max(4, v));

/**
 * Speed arc and drift line under a point on the window, given in screen
 * coordinates relative to the centre dot, with slide position vc under the
 * dot. Drift is positive to starboard (right).
 */
export function readPoint(face, vc, [x, y]) {
  const dy = originV(face) - (vc + y);
  return { speed: Math.hypot(x, dy) / face.unit, drift: Math.atan2(x, dy) / RAD };
}

/** Rotate a point clockwise on screen (y down) by `deg`. */
export function rotate([x, y], deg) {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  return [x * c - y * s, x * s + y * c];
}

// Disc coordinates: as the point would sit with 000 under the index.
// Putting heading H under the index turns the disc anticlockwise by H.
export const discToScreen = (p, heading) => rotate(p, -heading);
export const screenToDisc = (p, heading) => rotate(p, heading);

/** A mark drawn `units` below the centre dot while `heading` is under the index. */
export const markBelowCentre = (heading, units) => screenToDisc([0, units], heading);

/** A mark read as a vector from the centre dot (as a wind cross is drawn). */
export function vectorFromCentre([x, y], face) {
  const toward = mod360(Math.atan2(x, -y) / RAD);
  return { speed: Math.hypot(x, y) / face.unit, toward, from: mod360(toward + 180) };
}

/** Exact triangle of velocities, used to check the instrument. */
export function solveTriangle({ heading, tas, windFrom, windSpeed }) {
  const air = [tas * Math.sin(heading * RAD), tas * Math.cos(heading * RAD)];
  const to = (windFrom + 180) * RAD;
  const wind = [windSpeed * Math.sin(to), windSpeed * Math.cos(to)];
  const ground = [air[0] + wind[0], air[1] + wind[1]];
  const track = mod360(Math.atan2(ground[0], ground[1]) / RAD);
  let drift = track - heading;
  drift = ((drift + 540) % 360) - 180;
  return { track, groundSpeed: Math.hypot(ground[0], ground[1]), drift };
}

// ---------------------------------------------------------------------------
// Straight pencil lines.

/** Unit vector along the drift line `drift` degrees (positive starboard), pointing up the slide. */
const driftDirection = drift => [Math.sin(drift * RAD), -Math.cos(drift * RAD)];

/** The slide's zero-speed origin in screen coordinates relative to the centre dot. */
export const originOnScreen = (face, vc) => [0, originV(face) - vc];

/**
 * Where the drift line `drift` crosses the window, in screen coordinates
 * relative to the centre dot, or null if it misses the window at this slide
 * position.
 */
export function driftLineChord(face, vc, drift, radius = WINDOW_RADIUS) {
  const [, oy] = originOnScreen(face, vc);
  const [ux, uy] = driftDirection(drift);
  // |O + t·u|² = r² with O = (0, oy)
  const b = oy * uy;
  const disc = b * b - (oy * oy - radius * radius);
  if (disc <= 0) return null;
  const root = Math.sqrt(disc);
  const t0 = -b - root;
  const t1 = -b + root;
  const tStart = Math.max(t0, face.min * face.unit);
  if (t1 <= tStart) return null;
  return [[ux * tStart, oy + uy * tStart], [ux * t1, oy + uy * t1]];
}

/** Moves `p` onto the drift line that passes through `anchor` (screen coordinates). */
export function snapToDriftLine(face, vc, anchor, p) {
  const [ox, oy] = originOnScreen(face, vc);
  const dx = anchor[0] - ox;
  const dy = anchor[1] - oy;
  const len = Math.hypot(dx, dy);
  if (!len) return p;
  const ux = dx / len;
  const uy = dy / len;
  const t = (p[0] - anchor[0]) * ux + (p[1] - anchor[1]) * uy;
  return [anchor[0] + t * ux, anchor[1] + t * uy];
}

/** Where two infinite lines through (a1, b1) and (a2, b2) meet, or null if parallel. */
export function lineIntersection([ax, ay], [bx, by], [cx, cy], [dx, dy]) {
  const rx = bx - ax;
  const ry = by - ay;
  const sx = dx - cx;
  const sy = dy - cy;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / denom;
  return [ax + t * rx, ay + t * ry];
}
