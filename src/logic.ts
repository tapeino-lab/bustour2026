import { ANIMALS, BUS } from './pieces';

export const BUS_INTERVAL = 10;
export const PX_PER_METER = 50;

/** Which piece comes as the n-th piece (1-based). The bus comes first, then on every number ending in 0. */
export function pieceIdForIndex(n: number, rand: () => number): string {
  if (n === 1 || (n > 0 && n % BUS_INTERVAL === 0)) return BUS.id;
  const i = Math.min(ANIMALS.length - 1, Math.floor(rand() * ANIMALS.length));
  return ANIMALS[i].id;
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
