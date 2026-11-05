// A see-through index finger that shows how to play: tap the rotate button,
// then swipe left and right between the piece and the button.
// Drawn as an SVG element over the canvas and animated with the Web Animations API.

/** Hand drawing; the fingertip is at (22, 3) in its 60×80 box. */
const HAND_SVG = `
<svg viewBox="0 0 60 80" width="60" height="80" aria-hidden="true">
  <g fill="none" stroke="#23324a" stroke-width="3" stroke-linejoin="round">
    <rect x="15" y="2" width="14" height="42" rx="7" />
    <circle cx="34" cy="37" r="7" /><circle cx="42" cy="40" r="6.5" /><circle cx="48" cy="45" r="5.5" />
    <ellipse cx="11" cy="52" rx="6" ry="10" transform="rotate(-30 11 52)" />
    <rect x="10" y="34" width="42" height="38" rx="13" />
  </g>
  <g fill="#ffffff">
    <rect x="15" y="2" width="14" height="42" rx="7" />
    <circle cx="34" cy="37" r="7" /><circle cx="42" cy="40" r="6.5" /><circle cx="48" cy="45" r="5.5" />
    <ellipse cx="11" cy="52" rx="6" ry="10" transform="rotate(-30 11 52)" />
    <rect x="10" y="34" width="42" height="38" rx="13" />
  </g>
</svg>`;
const TIP_X = 22;
const TIP_Y = 3;
const DURATION_MS = 5200;

export interface TutorialPoints {
  /** Centre of the rotate button (CSS px, relative to the game area). */
  tap: { x: number; y: number };
  /** Swipe line: from left to right at height y. */
  swipe: { left: number; right: number; y: number };
}

export class Tutorial {
  private readonly el: HTMLDivElement;
  private anim: Animation | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'tutorial';
    this.el.innerHTML = HAND_SVG;
    parent.appendChild(this.el);
  }

  get running(): boolean {
    return this.anim !== null;
  }

  start(p: TutorialPoints): void {
    this.stop();
    // The hand points down from above, so it stays fully on screen even over the bottom button.
    const at = (x: number, y: number, s = 1) =>
      `translate(${x - TIP_X}px, ${y - TIP_Y}px) rotate(180deg) scale(${s})`;
    const { tap, swipe } = p;
    const mid = (swipe.left + swipe.right) / 2;
    const k: Keyframe[] = [
      // Appear on the button and tap it twice.
      { offset: 0, opacity: 0, transform: at(tap.x, tap.y - 30) },
      { offset: 0.06, opacity: 1, transform: at(tap.x, tap.y) },
      { offset: 0.11, transform: at(tap.x, tap.y, 0.85) },
      { offset: 0.16, transform: at(tap.x, tap.y) },
      { offset: 0.21, transform: at(tap.x, tap.y, 0.85) },
      { offset: 0.26, transform: at(tap.x, tap.y) },
      // Move up and swipe left and right.
      { offset: 0.36, transform: at(mid, swipe.y) },
      { offset: 0.46, transform: at(swipe.left, swipe.y) },
      { offset: 0.6, transform: at(swipe.right, swipe.y) },
      { offset: 0.74, transform: at(swipe.left, swipe.y) },
      { offset: 0.86, opacity: 1, transform: at(mid, swipe.y) },
      { offset: 0.94, opacity: 0, transform: at(mid, swipe.y) },
      { offset: 1, opacity: 0, transform: at(mid, swipe.y) },
    ];
    this.el.classList.add('on');
    this.anim = this.el.animate(k, { duration: DURATION_MS, iterations: Infinity, easing: 'ease-in-out' });
  }

  stop(): void {
    this.anim?.cancel();
    this.anim = null;
    this.el.classList.remove('on', 'paused');
  }

  /** Hides the hand while a finger is on the screen, without restarting the animation. */
  setPaused(paused: boolean): void {
    this.el.classList.toggle('paused', paused && this.running);
  }
}
