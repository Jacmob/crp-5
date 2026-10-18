// App wiring: builds both sides of the computer, holds the state of its
// moving parts, and turns pointer, keyboard and form input into the same
// physical moves you would make on the real instrument.

import { buildSlideFace } from './slide.js';
import { buildCalculator } from './calculator.js';
import { buildWind, renderMarks } from './wind.js';
import { Viewport } from './viewport.js';
import * as cs from './calcscales.js';
import * as wm from './windmath.js';
import { speedOfSoundKt, cToK } from './atmosphere.js';

const STORAGE_KEY = 'crp5-emulator:v1';
const RAD = Math.PI / 180;

const svg = document.getElementById('stage');
const defs = svg.querySelector('defs');
const world = document.getElementById('world');
const calcRoot = document.getElementById('calc-root');
const windRoot = document.getElementById('wind-root');

buildSlideFace(wm.FACES.L, defs);
buildSlideFace(wm.FACES.H, defs);
const calc = buildCalculator(calcRoot, defs);
const wind = buildWind(windRoot, defs);

// ---------------------------------------------------------------------------
// State

const defaultState = () => ({
  side: 'calc',
  tool: 'move',
  readouts: true,
  calc: { disc: 0, cursor: 32 },
  wind: { heading: 0, slideV: wm.speedToV(wm.FACES.L, 150), face: 'L', marks: [] },
});

const state = loadState();
let marksDirty = true;

function loadState() {
  const fresh = defaultState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return fresh;
    return {
      ...fresh,
      ...saved,
      calc: { ...fresh.calc, ...saved.calc },
      wind: { ...fresh.wind, ...saved.wind, marks: Array.isArray(saved.wind?.marks) ? saved.wind.marks : [] },
    };
  } catch {
    return fresh;
  }
}

let saveTimer = 0;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private mode); the emulator works without it.
    }
  }, 250);
}

const face = () => wm.FACES[state.wind.face];

// ---------------------------------------------------------------------------
// Rendering

let frame = 0;
function requestRender() {
  if (!frame) frame = requestAnimationFrame(render);
}

function render() {
  frame = 0;
  const isCalc = state.side === 'calc';
  calcRoot.style.display = isCalc ? '' : 'none';
  windRoot.style.display = isCalc ? 'none' : '';

  calc.disc.setAttribute('transform', `rotate(${state.calc.disc.toFixed(4)})`);
  calc.cursor.setAttribute('transform', `rotate(${state.calc.cursor.toFixed(4)})`);
  wind.disc.setAttribute('transform', `rotate(${(-state.wind.heading).toFixed(4)})`);
  const slide = `translate(0 ${(-state.wind.slideV).toFixed(4)})`;
  wind.slideHolder.setAttribute('transform', slide);
  calc.slideHolder.setAttribute('transform', slide);
  wind.slideUse.setAttribute('href', `#slide-face-${state.wind.face}`);
  calc.slideUse.setAttribute('href', `#slide-face-${wm.otherFace(state.wind.face)}`);

  if (marksDirty) {
    renderMarks(wind.marks, state.wind.marks);
    marksDirty = false;
  }

  for (const b of document.querySelectorAll('[data-side]')) b.setAttribute('aria-selected', String(b.dataset.side === state.side));
  for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === state.tool));
  for (const b of document.querySelectorAll('[data-face]')) b.setAttribute('aria-pressed', String(b.dataset.face === state.wind.face));
  svg.classList.toggle('tool-move', state.tool === 'move');
  svg.classList.toggle('tool-pencil', state.tool === 'pencil');
  svg.classList.toggle('tool-line', state.tool === 'line');
  svg.classList.toggle('tool-eraser', state.tool === 'eraser');

  renderReadouts();
  saveState();
}

// ---------------------------------------------------------------------------
// Readouts

const readoutList = document.getElementById('readout-list');
const showReadouts = document.getElementById('show-readouts');
const readoutsHidden = document.getElementById('readouts-hidden');

const fix = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const sig = v => (v >= 100 ? v.toFixed(1) : v.toFixed(2));
const bearing = a => String(Math.round(wm.mod360(a)) % 360).padStart(3, '0');
const feet = h => `${Math.round(h / 10) * 10}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const signedC = c => `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c).toFixed(1)} °C`;

function renderReadouts() {
  showReadouts.checked = state.readouts;
  readoutList.hidden = !state.readouts;
  readoutsHidden.hidden = state.readouts;
  if (!state.readouts) return;
  const rows = state.side === 'calc' ? calcReadouts() : windReadouts();
  readoutList.replaceChildren(...rows.flatMap(([term, detail]) => {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = detail;
    return [dt, dd];
  }));
}

function calcReadouts() {
  const theta = cs.mod360(state.calc.disc);
  const rows = [];
  const at10 = cs.mantissaAt(theta);
  rows.push(['Inner 10 is against outer', `${sig(at10)}   (ratio ×${(at10 / 10).toFixed(4)})`]);
  const outer = cs.mantissaAt(state.calc.cursor);
  const inner = cs.mantissaAt(state.calc.cursor - theta);
  rows.push(['Cursor', `outer ${sig(outer)} · inner ${sig(inner)}`]);
  rows.push(['Hours ring at cursor', cs.formatHours(cs.hoursForMantissa(inner))]);
  const t = cs.wrap180(theta);
  const da = cs.densityAltitudeFor(theta);
  if (Number.isFinite(da)) rows.push(['Density altitude arrow', `${feet(da).replace('-', '−')} ft`]);
  const cc = cs.compCorrAt(t);
  if (Number.isFinite(cc)) rows.push(['Comp Corr arrow', `${cc.toFixed(2)} div`]);
  const machCoat = cs.coatAtMachIndex(theta);
  if (machCoat >= cs.COAT_RANGE[0] && machCoat <= cs.COAT_RANGE[1]) {
    rows.push(['Mach index against COAT', `${signedC(machCoat)} (LSS ${Math.round(speedOfSoundKt(cToK(machCoat)))} kt)`]);
  }
  return rows;
}

function windReadouts() {
  const f = face();
  const { heading, slideV } = state.wind;
  const rows = [
    ['Under TRUE HEADING', `${fix(wm.mod360(heading), 1)}°`],
    ['Under centre dot', `${fix(wm.vToSpeed(f, slideV), 1)} kt (${f.id} side)`],
  ];
  const gridOffset = f.gridTopV - slideV;
  if (Math.abs(gridOffset) < 40) {
    rows.push(['Grid top line', `${fix(Math.abs(gridOffset) / f.unit, 1)} kt ${gridOffset < 0 ? 'above' : 'below'} the dot`]);
  }
  const pointRows = (label, p) => {
    const screen = wm.discToScreen(p, heading);
    const { speed, drift } = wm.readPoint(f, slideV, screen);
    const side = drift < -0.05 ? 'P' : drift > 0.05 ? 'S' : '';
    const vec = wm.vectorFromCentre(p, f);
    rows.push([label, `GS ${fix(speed)} kt · drift ${fix(Math.abs(drift))}° ${side} → track ${bearing(heading + drift)}°`]);
    rows.push(['   as a wind cross', `W/V ${bearing(vec.from)}° / ${fix(vec.speed)} kt`]);
    rows.push(['   from the dot', `${fix(Math.abs(screen[0]) / f.unit)} ${screen[0] < 0 ? 'left' : 'right'}, ${fix(Math.abs(screen[1]) / f.unit)} ${screen[1] < 0 ? 'above' : 'below'}`]);
  };
  const crosses = state.wind.marks.filter(m => m.type === 'cross');
  crosses.slice(0, 6).forEach((mark, i) => pointRows(`Cross ${i + 1}`, mark.p));
  const segments = state.wind.marks.filter(m => m.type === 'segment');
  if (segments.length >= 2) {
    const [s1, s2] = segments.slice(-2);
    const meet = wm.lineIntersection(s1.a, s1.b, s2.a, s2.b);
    if (meet && Math.hypot(meet[0], meet[1]) < wm.WINDOW_RADIUS) pointRows('Last two lines cross', meet);
    else rows.push(['Last two lines', 'do not cross in the window']);
  }
  if (!crosses.length && segments.length < 2) rows.push(['Pencil crosses', 'none yet']);
  return rows;
}

// ---------------------------------------------------------------------------
// View

const viewport = new Viewport(svg, world, { fitWidth: 236, fitHeight: 246 });

function setSide(side) {
  state.side = side;
  document.body.dataset.view = side;
  updateHint();
  requestRender();
}

const hint = document.getElementById('stage-hint');
function updateHint() {
  hint.textContent = state.side === 'calc'
    ? 'Drag the disc to turn it · drag the hairline or outer ring to move the cursor · Shift for fine'
    : state.tool === 'pencil'
      ? 'Pencil: click in the window for a cross, drag to draw freehand'
      : state.tool === 'line'
        ? 'Line: drag a straight line · hold Shift to lay it along the drift line where you start'
        : state.tool === 'eraser'
          ? 'Rubber: click or drag over pencil marks'
          : 'Drag the ring to turn the disc · drag inside the window to move the slide · Shift for fine';
}

// ---------------------------------------------------------------------------
// Pointer input

const pointers = new Map();
let drag = null;

function localPoint(group, clientX, clientY) {
  const p = new DOMPoint(clientX, clientY).matrixTransform(group.getScreenCTM().inverse());
  return [p.x, p.y];
}

const angleOf = ([x, y]) => Math.atan2(x, -y) / RAD;

function startRotate(group, apply, e) {
  let last = angleOf(localPoint(group, e.clientX, e.clientY));
  return {
    move(ev) {
      const p = localPoint(group, ev.clientX, ev.clientY);
      if (Math.hypot(p[0], p[1]) < 4) return;
      const a = angleOf(p);
      const delta = cs.wrap180(a - last) * (ev.shiftKey ? 0.1 : 1);
      last = a;
      apply(delta);
      requestRender();
    },
  };
}

function startSlide(group, e) {
  let last = localPoint(group, e.clientX, e.clientY)[1];
  return {
    move(ev) {
      const y = localPoint(group, ev.clientX, ev.clientY)[1];
      const dy = (y - last) * (ev.shiftKey ? 0.1 : 1);
      last = y;
      state.wind.slideV = wm.clampSlideV(state.wind.slideV - dy);
      requestRender();
    },
  };
}

function startPan(e) {
  let last = [e.clientX, e.clientY];
  return {
    move(ev) {
      viewport.panBy(ev.clientX - last[0], ev.clientY - last[1]);
      last = [ev.clientX, ev.clientY];
    },
  };
}

function startPencil(e) {
  const start = localPoint(wind.marks, e.clientX, e.clientY);
  const line = { type: 'line', points: [start] };
  let length = 0;
  return {
    move(ev) {
      const p = localPoint(wind.marks, ev.clientX, ev.clientY);
      const prev = line.points[line.points.length - 1];
      const step = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      if (step < 0.35) return;
      line.points.push(p.map(v => Math.round(v * 100) / 100));
      length += step;
      if (line.points.length === 2) state.wind.marks.push(line);
      marksDirty = true;
      requestRender();
    },
    end() {
      if (length < 1.2) {
        if (line.points.length > 1) state.wind.marks.splice(state.wind.marks.indexOf(line), 1);
        state.wind.marks.push({ type: 'cross', p: start.map(v => Math.round(v * 100) / 100) });
      }
      marksDirty = true;
      requestRender();
    },
  };
}

// Straight line: drawn in screen terms so Shift can lay it along a drift
// line on the slide, then stored in disc coordinates so it turns with the disc.
function startSegment(e) {
  const start = localPoint(windRoot, e.clientX, e.clientY);
  const mark = { type: 'segment', a: null, b: null };
  let added = false;
  const round = p => p.map(v => Math.round(v * 1000) / 1000);
  return {
    move(ev) {
      let end = localPoint(windRoot, ev.clientX, ev.clientY);
      if (ev.shiftKey) end = wm.snapToDriftLine(face(), state.wind.slideV, start, end);
      if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 0.5) return;
      mark.a = round(wm.screenToDisc(start, state.wind.heading));
      mark.b = round(wm.screenToDisc(end, state.wind.heading));
      if (!added) {
        state.wind.marks.push(mark);
        added = true;
      }
      marksDirty = true;
      requestRender();
    },
  };
}

function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function eraseAt(p) {
  const radius = 3.5;
  const before = state.wind.marks.length;
  state.wind.marks = state.wind.marks.filter(mark => {
    if (mark.type === 'cross') return Math.hypot(mark.p[0] - p[0], mark.p[1] - p[1]) > radius;
    if (mark.type === 'segment') return distanceToSegment(p, mark.a, mark.b) > radius;
    for (let i = 1; i < mark.points.length; i++) {
      if (distanceToSegment(p, mark.points[i - 1], mark.points[i]) <= radius) return false;
    }
    return true;
  });
  if (state.wind.marks.length !== before) {
    marksDirty = true;
    requestRender();
  }
}

function startEraser(e) {
  eraseAt(localPoint(wind.marks, e.clientX, e.clientY));
  return { move: ev => eraseAt(localPoint(wind.marks, ev.clientX, ev.clientY)) };
}

function startDrag(hit, e) {
  switch (hit) {
    case 'calc-disc':
      return startRotate(calc.dial, d => { state.calc.disc = cs.mod360(state.calc.disc + d); }, e);
    case 'calc-cursor':
    case 'calc-ring':
      return startRotate(calc.dial, d => { state.calc.cursor = cs.mod360(state.calc.cursor + d); }, e);
    case 'wind-ring':
      return startRotate(windRoot, d => { state.wind.heading = wm.mod360(state.wind.heading - d); }, e);
    case 'wind-window':
      if (state.tool === 'pencil') return startPencil(e);
      if (state.tool === 'line') return startSegment(e);
      if (state.tool === 'eraser') return startEraser(e);
      return startSlide(windRoot, e);
    case 'slide':
      return startSlide(state.side === 'calc' ? calcRoot : windRoot, e);
    default:
      return startPan(e);
  }
}

function pinchState() {
  const [a, b] = [...pointers.values()];
  return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: [(a.x + b.x) / 2, (a.y + b.y) / 2] };
}

svg.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  try {
    svg.setPointerCapture(e.pointerId);
  } catch {
    // Not every pointer can be captured (e.g. synthetic events); dragging still works.
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    drag?.end?.();
    drag = { pinch: pinchState() };
    return;
  }
  if (pointers.size > 2) return;
  const hit = e.target.closest?.('[data-hit]')?.dataset.hit;
  drag = startDrag(hit, e);
  svg.classList.add('dragging');
  e.preventDefault();
});

svg.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (drag?.pinch && pointers.size === 2) {
    const now = pinchState();
    viewport.zoomAt(now.mid[0], now.mid[1], now.dist / drag.pinch.dist);
    viewport.panBy(now.mid[0] - drag.pinch.mid[0], now.mid[1] - drag.pinch.mid[1]);
    drag.pinch = now;
  } else {
    drag?.move?.(e);
  }
});

function endPointer(e) {
  if (!pointers.delete(e.pointerId)) return;
  if (!pointers.size) {
    drag?.end?.();
    drag = null;
    svg.classList.remove('dragging');
  } else if (drag?.pinch) {
    drag = null;
  }
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);

svg.addEventListener('wheel', e => {
  e.preventDefault();
  const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  viewport.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * scale * (e.ctrlKey ? 0.01 : 0.0018)));
}, { passive: false });

// ---------------------------------------------------------------------------
// Buttons and forms

const num = id => parseFloat(document.getElementById(id).value);

function onSubmit(id, handler) {
  document.getElementById(id).addEventListener('submit', e => {
    e.preventDefault();
    handler();
    requestRender();
  });
}

onSubmit('calc-align-form', () => {
  const inner = num('calc-inner');
  const outer = num('calc-outer');
  if (inner > 0 && outer > 0) state.calc.disc = cs.rotationFor(inner, outer);
});

onSubmit('calc-cursor-form', () => {
  const v = num('calc-cursor-value');
  if (!(v > 0)) return;
  const onInner = document.getElementById('calc-cursor-scale').value === 'inner';
  state.calc.cursor = cs.mod360(cs.valueAngle(v) + (onInner ? state.calc.disc : 0));
});

onSubmit('wind-heading-form', () => {
  const v = num('wind-heading');
  if (Number.isFinite(v)) state.wind.heading = wm.mod360(v);
});

onSubmit('wind-speed-form', () => {
  const v = num('wind-speed');
  if (Number.isFinite(v)) state.wind.slideV = wm.clampSlideV(wm.speedToV(face(), v));
});

onSubmit('wind-mark-form', () => {
  const v = num('wind-mark');
  if (!(v >= 0)) return;
  const p = wm.markBelowCentre(state.wind.heading, v * face().unit);
  state.wind.marks.push({ type: 'cross', p: p.map(x => Math.round(x * 1000) / 1000) });
  marksDirty = true;
});

onSubmit('wind-line-form', () => {
  const v = num('wind-line');
  if (!(v >= 0)) return;
  const drift = document.getElementById('wind-line-side').value === 'P' ? -v : v;
  const chord = wm.driftLineChord(face(), state.wind.slideV, drift);
  if (!chord) {
    hint.textContent = 'That drift line does not cross the window with the slide where it is';
    return;
  }
  const [a, b] = chord.map(p => wm.screenToDisc(p, state.wind.heading).map(x => Math.round(x * 1000) / 1000));
  state.wind.marks.push({ type: 'segment', a, b });
  marksDirty = true;
});

function undoMark() {
  if (!state.wind.marks.length) return;
  state.wind.marks.pop();
  marksDirty = true;
  requestRender();
}

document.getElementById('undo-mark').addEventListener('click', undoMark);

document.getElementById('calc-reset').addEventListener('click', () => {
  state.calc.disc = 0;
  requestRender();
});

document.getElementById('grid-top').addEventListener('click', () => {
  state.wind.face = 'L';
  state.wind.slideV = wm.FACES.L.gridTopV;
  requestRender();
});

const nudge = {
  disc: step => { state.calc.disc = cs.mod360(state.calc.disc + step); },
  cursor: step => { state.calc.cursor = cs.mod360(state.calc.cursor + step); },
  heading: step => { state.wind.heading = wm.mod360(Math.round((state.wind.heading + step) * 1000) / 1000); },
  slide: step => { state.wind.slideV = wm.clampSlideV(state.wind.slideV - step * face().unit); },
};

for (const button of document.querySelectorAll('[data-nudge]')) {
  let timer = 0;
  const fire = () => {
    nudge[button.dataset.nudge](parseFloat(button.dataset.step));
    requestRender();
  };
  const stop = () => clearTimeout(timer);
  button.addEventListener('pointerdown', e => {
    e.preventDefault();
    fire();
    const repeat = delay => { timer = setTimeout(() => { fire(); repeat(60); }, delay); };
    repeat(400);
  });
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointerleave', stop);
  button.addEventListener('pointercancel', stop);
  button.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fire();
    }
  });
}

for (const b of document.querySelectorAll('[data-side]')) b.addEventListener('click', () => setSide(b.dataset.side));

for (const b of document.querySelectorAll('[data-tool]')) {
  b.addEventListener('click', () => {
    state.tool = b.dataset.tool;
    updateHint();
    requestRender();
  });
}

for (const b of document.querySelectorAll('[data-face]')) {
  b.addEventListener('click', () => {
    state.wind.face = b.dataset.face;
    requestRender();
  });
}

document.getElementById('clear-marks').addEventListener('click', () => {
  state.wind.marks = [];
  marksDirty = true;
  requestRender();
});

showReadouts.addEventListener('change', () => {
  state.readouts = showReadouts.checked;
  requestRender();
});

document.getElementById('zoom-in').addEventListener('click', () => viewport.zoomBy(1.4));
document.getElementById('zoom-out').addEventListener('click', () => viewport.zoomBy(1 / 1.4));
document.getElementById('zoom-fit').addEventListener('click', () => viewport.reset());
document.getElementById('rotate-left').addEventListener('click', () => viewport.rotateBy(-90));
document.getElementById('rotate-right').addEventListener('click', () => viewport.rotateBy(90));

// ---------------------------------------------------------------------------
// Keyboard

window.addEventListener('keydown', e => {
  if (e.target.closest?.('input, select, textarea')) return;
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && state.side === 'wind') {
    e.preventDefault();
    undoMark();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const big = e.shiftKey ? 10 : 1;
  const isCalc = state.side === 'calc';
  let handled = true;
  switch (e.key) {
    case 'ArrowLeft':
      if (isCalc) nudge.disc(-0.1 * big);
      else nudge.heading(big);
      break;
    case 'ArrowRight':
      if (isCalc) nudge.disc(0.1 * big);
      else nudge.heading(-big);
      break;
    case 'ArrowUp':
      if (isCalc) handled = false;
      else nudge.slide(-big);
      break;
    case 'ArrowDown':
      if (isCalc) handled = false;
      else nudge.slide(big);
      break;
    case '[': case '{': nudge.cursor(-0.1 * big); break;
    case ']': case '}': nudge.cursor(0.1 * big); break;
    case 'f': case 'F': setSide(isCalc ? 'wind' : 'calc'); break;
    case 'm': case 'M': state.tool = 'move'; updateHint(); break;
    case 'p': case 'P': state.tool = 'pencil'; updateHint(); break;
    case 'l': case 'L': state.tool = 'line'; updateHint(); break;
    case 'e': case 'E': state.tool = 'eraser'; updateHint(); break;
    case '+': case '=': viewport.zoomBy(1.25); break;
    case '-': case '_': viewport.zoomBy(0.8); break;
    case '0': viewport.reset(); break;
    case 'r': case 'R': viewport.rotateBy(e.shiftKey ? -90 : 90); break;
    default: handled = false;
  }
  if (handled) {
    e.preventDefault();
    requestRender();
  }
});

// ---------------------------------------------------------------------------
// Source link: on GitHub Pages (<user>.github.io/<repo>/) point at the repo.

const pages = location.hostname.match(/^([\w-]+)\.github\.io$/);
if (pages) {
  const repo = location.pathname.split('/').filter(Boolean)[0];
  document.getElementById('source-link').href = `https://github.com/${pages[1]}/${repo ?? `${pages[1]}.github.io`}`;
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

document.body.dataset.view = state.side;
updateHint();
render();

// Exposed for debugging in the console.
window.crp5 = { state, viewport, render: requestRender };
