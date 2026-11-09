import { ANIMALS, BUS } from './pieces';

export const PX_PER_METER = 50;

/**
 * The order the pieces come in, one game at a time, in laps: every lap starts with the bus,
 * followed by all the animals once each in a shuffled order (colour variants are separate
 * animals). After the last animal the next lap starts, again with the bus and a new shuffle.
 */
export class PieceBag {
  private lap: string[] = [];

  constructor(private readonly rand: () => number = Math.random) {}

  next(): string {
    if (this.lap.length === 0) this.lap = [BUS.id, ...shuffle(ANIMALS.map((a) => a.id), this.rand)];
    return this.lap.shift()!;
  }
}

/** A shuffled copy (Fisher–Yates). */
export function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rand() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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
