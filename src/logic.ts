import { ANIMALS, BUS } from './pieces';

export const PX_PER_METER = 50;

/**
 * Which piece comes as the n-th piece (1-based): the bus first (only then), and after that a
 * random animal that is never the same as the previous one (`prevId`).
 */
export function pieceIdForIndex(n: number, rand: () => number, prevId?: string): string {
  if (n === 1) return BUS.id;
  const choices = ANIMALS.filter((a) => a.id !== prevId);
  const i = Math.min(choices.length - 1, Math.floor(rand() * choices.length));
  return choices[i].id;
}

export function heightMeters(px: number): number {
  return Math.max(0, Math.floor((px / PX_PER_METER) * 10) / 10);
}

export interface Motion {
  speed: number;
  angularSpeed: number;
}

/** Reports settled once every body has stayed nearly still for `frames` consecutive steps. */
export class SettleTracker {
  private still = 0;
  private elapsed = 0;

  constructor(
    private readonly frames = 40,
    private readonly maxFrames = 600,
    private readonly speedLimit = 0.08,
    private readonly angularLimit = 0.004,
  ) {}

  reset(): void {
    this.still = 0;
    this.elapsed = 0;
  }

  update(motions: Motion[]): boolean {
    this.elapsed++;
    const calm = motions.every((m) => m.speed < this.speedLimit && m.angularSpeed < this.angularLimit);
    this.still = calm ? this.still + 1 : 0;
    return this.still >= this.frames || this.elapsed >= this.maxFrames;
  }
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
