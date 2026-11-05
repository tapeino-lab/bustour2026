// On-screen diagnostics, enabled with ?debug=1 in the URL. Shows frame timing, physics steps
// per frame and resize activity, so device-specific problems (like flicker) can be narrowed down
// from a screenshot.

export class DebugOverlay {
  private readonly el: HTMLDivElement;
  private frames = 0;
  private dtMin = Infinity;
  private dtMax = 0;
  private stepsMax = 0;
  private renders = 0;
  private resizes = 0;
  private lastResize = '';
  private windowStart = performance.now();
  private text = '';

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'debug';
    parent.appendChild(this.el);
  }

  frame(dt: number, steps: number): void {
    this.frames++;
    this.dtMin = Math.min(this.dtMin, dt);
    this.dtMax = Math.max(this.dtMax, dt);
    this.stepsMax = Math.max(this.stepsMax, steps);
  }

  render(): void {
    this.renders++;
  }

  resize(info: string): void {
    this.resizes++;
    this.lastResize = info;
  }

  /** Updates the text twice a second; `extra` is appended as-is. */
  update(extra: string): void {
    const now = performance.now();
    const span = now - this.windowStart;
    if (span < 500) return;
    const fps = (this.frames * 1000) / span;
    const rpf = this.frames ? this.renders / this.frames : 0;
    this.text =
      `fps ${fps.toFixed(0)}  dt ${this.dtMin.toFixed(1)}–${this.dtMax.toFixed(1)}ms  steps/frame≤${this.stepsMax}  renders/frame ${rpf.toFixed(2)}\n` +
      `resizes ${this.resizes} (last ${this.lastResize})  window ${innerWidth}×${innerHeight} dpr ${devicePixelRatio}\n` +
      extra;
    this.el.textContent = this.text;
    this.frames = 0;
    this.renders = 0;
    this.dtMin = Infinity;
    this.dtMax = 0;
    this.stepsMax = 0;
    this.windowStart = now;
  }
}
