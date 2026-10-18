// Zoom, pan and rotation of the view. The SVG viewBox always matches the
// element's aspect ratio; rotation is applied to the world group so the
// instrument can be turned like a real one while panning stays screen-aligned.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class Viewport {
  constructor(svg, world, { fitWidth, fitHeight, onChange }) {
    this.svg = svg;
    this.world = world;
    this.fitWidth = fitWidth;
    this.fitHeight = fitHeight;
    this.onChange = onChange;
    this.reset();
    new ResizeObserver(() => this.apply()).observe(svg);
  }

  reset() {
    this.cx = 0;
    this.cy = 0;
    this.zoom = 1;
    this.rotation = 0;
    this.apply();
  }

  unitsPerPixel() {
    const { width, height } = this.svg.getBoundingClientRect();
    const sideways = this.rotation % 180 !== 0;
    const fw = sideways ? this.fitHeight : this.fitWidth;
    const fh = sideways ? this.fitWidth : this.fitHeight;
    return Math.max(fw / width, fh / height) / this.zoom;
  }

  apply() {
    const { width, height } = this.svg.getBoundingClientRect();
    if (!width || !height) return;
    const s = this.unitsPerPixel();
    const w = width * s;
    const h = height * s;
    this.svg.setAttribute('viewBox', `${this.cx - w / 2} ${this.cy - h / 2} ${w} ${h}`);
    this.world.setAttribute('transform', `rotate(${this.rotation})`);
    this.onChange?.(this);
  }

  clientToView(clientX, clientY) {
    const rect = this.svg.getBoundingClientRect();
    const s = this.unitsPerPixel();
    return [this.cx + (clientX - rect.left - rect.width / 2) * s, this.cy + (clientY - rect.top - rect.height / 2) * s];
  }

  zoomAt(clientX, clientY, factor) {
    const before = this.clientToView(clientX, clientY);
    this.zoom = clamp(this.zoom * factor, 0.4, 16);
    const after = this.clientToView(clientX, clientY);
    this.cx = clamp(this.cx + before[0] - after[0], -500, 500);
    this.cy = clamp(this.cy + before[1] - after[1], -500, 500);
    this.apply();
  }

  zoomBy(factor) {
    const rect = this.svg.getBoundingClientRect();
    this.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  panBy(dxClient, dyClient) {
    const s = this.unitsPerPixel();
    this.cx = clamp(this.cx - dxClient * s, -500, 500);
    this.cy = clamp(this.cy - dyClient * s, -500, 500);
    this.apply();
  }

  rotateBy(degrees) {
    this.rotation = (((this.rotation + degrees) % 360) + 360) % 360;
    this.apply();
  }
}
