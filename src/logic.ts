import { ANIMALS, BUS } from './pieces';

export const PX_PER_METER = 50;

/**
 * Which piece comes as the n-th piece (1-based): the bus first (only then), and after that a
 * random animal that is never the same animal as the previous one (`prevId`) — colour variants
 * of one animal (same `kind`) count as the same.
 */
export function pieceIdForIndex(n: number, rand: () => number, prevId?: string): string {
  if (n === 1) return BUS.id;
  const kindOf = (id: string | undefined) => ANIMALS.find((a) => a.id === id)?.kind ?? id;
  const prevKind = kindOf(prevId);
  const choices = ANIMALS.filter((a) => (a.kind ?? a.id) !== prevKind);
  const i = Math.min(choices.length - 1, Math.floor(rand() * choices.length));
  return choices[i].id;
}

/** Tower height in metres, kept to two decimals (shown with one, see formatHeight). */
export function heightMeters(px: number): number {
  return Math.max(0, Math.floor((px / PX_PER_METER) * 100) / 100);
}

/** A height for display: one decimal, cut off (not rounded) so 9.96m does not show as 10.0. */
export function formatHeight(m: number): string {
  return (Math.floor(Math.round(m * 100) / 10) / 10).toFixed(1);
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
