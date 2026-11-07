// Piece definitions. All coordinates are local, in logical pixels, origin near the piece centre, y down.
// Shapes made of `parts` take part in physics; `details` are drawn only.
// `face` is the circle where a face photo is placed (dummy face until an image is provided).
//
// Most pieces are one rigid body. A piece may instead be split into segments (`seg` on its
// shapes) joined by soft welds (`joints`), so it bends a little like a real, soft animal.

interface ShapeBase {
  color: string;
  /** Which segment (body) of the piece the shape belongs to; 0 by default. */
  seg?: number;
  /** Friction of this part (default: the normal high friction). */
  friction?: number;
  /** Drawn without the ink outline (and its collision has no outline skin either). */
  noOutline?: boolean;
}
export type Shape =
  | (ShapeBase & { kind: 'rect'; x: number; y: number; w: number; h: number; round?: number })
  /** `exact`: a true circle in physics and drawing (e.g. wheels); otherwise a slightly faceted one. */
  | (ShapeBase & { kind: 'circle'; x: number; y: number; r: number; exact?: boolean })
  | (ShapeBase & { kind: 'poly'; points: [number, number][] });

export interface FaceSpot {
  x: number;
  y: number;
  r: number;
  seg?: number;
}

/** A soft weld between two segments at a local anchor point. */
export interface SoftJoint {
  a: number;
  b: number;
  x: number;
  y: number;
  /** Stiffness (Hz; lower = floppier) and damping (1 = no wobble, lower = wobbles a bit). */
  hz?: number;
  damping?: number;
  /**
   * A hinge instead of a weld: segment b can only turn within [min, max] radians relative to a,
   * from its starting angle, e.g. a knee that only bends outwards.
   */
  hinge?: [number, number];
  /** A hinge that swings freely (no friction), like a dangling tail. */
  loose?: boolean;
  /** Hinge range once the piece has touched something (until then `hinge` applies); 'free' = no limit. */
  landed?: [number, number] | 'free';
}

export interface PieceDef {
  id: string;
  name: string;
  /** Variants of the same animal share a kind (they never come one after another). */
  kind?: string;
  parts: Shape[];
  details?: Shape[];
  face?: FaceSpot;
  joints?: SoftJoint[];
  /**
   * Segments whose motion decides when a soft piece has come to rest (all by default). Floppy
   * parts left out may still wobble a little; they are locked in place when the piece settles.
   */
  settleSegments?: number[];
  /**
   * A photo drawn instead of the parts, in this local box. The photo itself is not in the
   * repository: it is uploaded on the admin page (stored like face photos, members only).
   * Without it the parts are shown as a plain silhouette.
   */
  sprite?: { x: number; y: number; w: number; h: number };
}

const rect = (x: number, y: number, w: number, h: number, color: string, round = 0, seg = 0): Shape => ({
  kind: 'rect', x, y, w, h, color, round, seg,
});
const circle = (x: number, y: number, r: number, color: string, seg = 0): Shape => ({ kind: 'circle', x, y, r, color, seg });
const wheel = (x: number, y: number, r: number, color: string): Shape => ({ kind: 'circle', x, y, r, color, exact: true, noOutline: true });
const poly = (color: string, ...points: [number, number][]): Shape => ({ kind: 'poly', points, color });
const polySeg = (seg: number, color: string, ...points: [number, number][]): Shape => ({ kind: 'poly', points, color, seg });

/** Part of a photo's silhouette: no ink outline (the photo has its own edges). */
const sil = (...points: [number, number][]): Shape => ({ kind: 'poly', points, color: '#9aa6b2', noOutline: true });

/** A straight limb (or stem) of width `w` from (x1, y1) to (x2, y2), as a convex quad. */
function limb(color: string, x1: number, y1: number, x2: number, y2: number, w: number): Shape {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = (-(y2 - y1) / len) * (w / 2);
  const ny = ((x2 - x1) / len) * (w / 2);
  return poly(color, [x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]);
}

/** A rounded, elongated shape (a capsule) from (x1, y1) to (x2, y2), as a convex 12-gon. */
function capsule(color: string, x1: number, y1: number, x2: number, y2: number, w: number): Shape {
  const r = w / 2;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 5; i++) {
    const t = a - Math.PI / 2 - (Math.PI * i) / 5; // round end around (x1, y1)
    pts.push([x1 + r * Math.cos(t), y1 + r * Math.sin(t)]);
  }
  for (let i = 0; i <= 5; i++) {
    const t = a + Math.PI / 2 - (Math.PI * i) / 5; // round end around (x2, y2)
    pts.push([x2 + r * Math.cos(t), y2 + r * Math.sin(t)]);
  }
  return { kind: 'poly', points: pts, color };
}

/** Light fuzz dots along a foxtail head from (x1, y1) to (x2, y2) (drawn only). */
function fuzz(x1: number, y1: number, x2: number, y2: number): Shape[] {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const out: Shape[] = [];
  for (let i = 0; i <= 7; i++) {
    const t = 0.08 + (i / 7) * 0.84;
    const side = i % 2 ? 3.5 : -3.5;
    out.push({ kind: 'circle', x: x1 + (x2 - x1) * t + nx * side, y: y1 + (y2 - y1) * t + ny * side, r: 1.7, color: '#eef5b0' });
  }
  return out;
}

/** A spiral line of dots around (cx, cy), out to radius `maxR` over `turns` turns (drawn only). */
function spiral(cx: number, cy: number, maxR: number, turns: number, color: string): Shape[] {
  const out: Shape[] = [];
  const total = Math.PI * 2 * turns;
  for (let t = 0.4; t <= total; ) {
    const r = 1.5 + (maxR - 1.5) * (t / total);
    out.push({ kind: 'circle', x: cx + r * Math.cos(t), y: cy + r * Math.sin(t), r: 1.7, color });
    t += 2.2 / Math.max(r, 2); // about one dot every 2 px along the line
  }
  return out;
}

/** Three little toes under a foot at (x, y) (drawn only). */
function toes(x: number, y: number, color: string, seg = 0): Shape[] {
  return [-3.5, 0, 3.5].map((dx) => ({ kind: 'circle' as const, x: x + dx, y, r: 2.4, color, seg }));
}

/** A cat in a given coat; `pattern` is drawn on the body. */
function catDef(id: string, name: string, fur: string, pattern: Shape[], ears = fur): PieceDef {
  return {
    id, name, kind: 'cat',
    parts: [
      rect(6, 12, 56, 30, fur, 12),
      circle(-24, -12, 19, fur),
      poly(ears, [-42, -18], [-38, -42], [-27, -29]),
      poly(ears, [-21, -31], [-10, -42], [-6, -18]),
      rect(37, -6, 8, 30, fur, 4),
    ],
    details: pattern,
    face: { x: -24, y: -12, r: 15 },
  };
}

/**
 * A sloth seen from the side, hanging from a branch (not drawn): body below, arms and legs
 * reaching up, head hanging at the front.
 */
function slothDef(id: string, name: string, fur: string, dark: string, mask: string): PieceDef {
  return {
    id, name, kind: 'sloth',
    parts: [
      limb(dark, 22, 4, 34, -42, 10),
      limb(dark, -10, 2, -4, -42, 10),
      capsule(fur, -18, 12, 30, 8, 30),
      limb(fur, 28, 2, 18, -42, 11),
      limb(fur, -16, 4, -24, -42, 11),
      circle(-34, 18, 16, mask),
    ],
    details: [
      ...[-29, -25, -21].map((x) => rect(x, -46, 2.5, 8, '#3b2f22', 1)),
      ...[15, 19, 23].map((x) => rect(x, -46, 2.5, 8, '#3b2f22', 1)),
      rect(4, 22, 34, 4, dark, 2),
    ],
    face: { x: -34, y: 18, r: 13 },
  };
}

/** Pointed petals around the centre: `n` petals from radius r1 to r2, `w` wide, two tones. */
function petals(n: number, r1: number, r2: number, w: number, light: string, deep: string): Shape[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const at = (along: number, across: number): [number, number] => [along * c - across * s, along * s + across * c];
    const mid = (r1 + r2) / 2;
    return poly(i % 2 ? deep : light, at(r1, 0), at(r1 + 4, w / 2), at(mid + 4, w / 2), at(r2, 0), at(mid + 4, -w / 2), at(r1 + 4, -w / 2));
  });
}

/** The cross-hatched seed pattern on a sunflower centre of radius r (drawn only). */
function seedGrid(r: number, color: string): Shape[] {
  const out: Shape[] = [];
  for (const d of [-12, -6, 0, 6, 12]) {
    const half = Math.sqrt(r * r - d * d) - 2;
    out.push(rect(d, 0, 1.6, half * 2, color), rect(0, d, half * 2, 1.6, color));
  }
  return out;
}

const RAW_ANIMALS: PieceDef[] = [
  catDef('cat', 'ちゃとら', '#f0a35e', [
    rect(-2, 6, 6, 22, '#c97a34', 3), rect(10, 6, 6, 22, '#c97a34', 3), rect(22, 6, 6, 22, '#c97a34', 3),
    rect(37, -2, 8, 4, '#c97a34', 2), rect(37, 8, 8, 4, '#c97a34', 2),
  ]),
  catDef('cowcat', 'しろくろねこ', '#f7f7f2', [
    poly('#1f1f24', [-8, 0], [12, -2], [16, 12], [0, 18], [-10, 12]),
    poly('#1f1f24', [22, 8], [32, 4], [34, 20], [24, 24]),
    rect(37, -12, 8, 14, '#1f1f24', 4),
  ], '#1f1f24'),
  catDef('blackcat', 'くろねこ', '#2b2b33', [rect(6, 20, 40, 6, '#3d3d48', 3)]),
  {
    id: 'dolphin', name: 'いるか',
    parts: [
      rect(0, 0, 84, 34, '#5b8fc9', 17),
      rect(-48, 6, 22, 10, '#5b8fc9', 5),
      poly('#4a7db6', [-4, -14], [10, -34], [18, -14]),
      poly('#4a7db6', [36, -4], [60, -20], [50, 2]),
      poly('#4a7db6', [36, 6], [50, -2], [60, 18]),
    ],
    details: [rect(-2, 11, 60, 9, '#d8e8f5', 4)],
    face: { x: -22, y: -1, r: 13 },
  },
  {
    id: 'bird', name: 'わたりどり',
    parts: [
      // Small and angular: no round parts.
      poly('#7a6a58', [-8, -4], [14, -6], [26, 4], [12, 16], [-6, 12]),
      poly('#7a6a58', [-27, -12], [-22, -24], [-9, -24], [-4, -12], [-9, 0], [-22, 0]),
      poly('#5e5040', [-2, -6], [16, -34], [24, -28], [12, -2]),
      poly('#e0a030', [-27, -15], [-38, -11], [-27, -7]),
      poly('#5e5040', [22, 4], [38, -4], [38, 10]),
    ],
    details: [poly('#efe6d8', [-4, 6], [12, 4], [18, 8], [10, 13], [-3, 10])],
    face: { x: -15, y: -12, r: 10 },
  },
  {
    id: 'leopard', name: 'めひょう',
    parts: [
      rect(8, 8, 78, 24, '#e8b84a', 12),
      rect(-20, 28, 10, 18, '#e8b84a', 4), rect(34, 28, 10, 18, '#e8b84a', 4),
      circle(-38, -6, 18, '#e8b84a'),
      poly('#e8b84a', [-55, -12], [-53, -31], [-42, -22]),
      poly('#e8b84a', [-34, -22], [-23, -31], [-21, -12]),
      rect(52, -10, 8, 30, '#e8b84a', 4),
    ],
    details: [
      circle(-8, 4, 4, '#5a3d1e'), circle(10, 12, 4, '#5a3d1e'), circle(26, 2, 4, '#5a3d1e'),
      circle(38, 14, 4, '#5a3d1e'), circle(0, 16, 3, '#5a3d1e'),
    ],
    face: { x: -38, y: -6, r: 14 },
  },
  slothDef('sloth', 'なまけもの（ちゃいろ）', '#8a6440', '#5f4227', '#d9b98a'),
  slothDef('graysloth', 'なまけもの（はいいろ）', '#c4c3ba', '#97968c', '#f2f0e6'),
  {
    // Very soft (ふにゃふにゃ): the head jiggles on a wobbly weld, the tail (base and tip) and the
    // two legs hang on loose hinges, so it flops down like the real thing and its legs dangle.
    id: 'axolotl', name: 'うーぱーるーぱー',
    parts: [
      circle(-40, 0, 18, '#f7a8c4', 0),
      polySeg(0, '#e57aa3', [-50, -12], [-64, -24], [-58, -29], [-46, -16]),
      polySeg(0, '#e57aa3', [-42, -17], [-44, -34], [-37, -34], [-35, -17]),
      polySeg(0, '#e57aa3', [-30, -13], [-21, -28], [-16, -24], [-25, -11]),
      rect(2, 6, 60, 22, '#f7a8c4', 11, 1),
      // The tail in two pieces (base and tip), so it bends in the middle.
      polySeg(2, '#f7a8c4', [30, -2], [50, 0], [50, 13], [30, 16]),
      polySeg(7, '#f7a8c4', [49, 0], [66, 2], [70, 10], [49, 13]),
      // Each leg has a knee: thigh and shin, already bent outwards, so under the body's weight the
      // knees give way outwards and the legs splay open. Slippery feet help them slide out.
      { ...limb('#f7a8c4', -20, 15, -28, 26, 8), seg: 3 },
      { ...limb('#f7a8c4', -28, 26, -40, 34, 7), seg: 4, friction: 0.2 },
      { ...limb('#f7a8c4', 24, 15, 32, 26, 8), seg: 5 },
      { ...limb('#f7a8c4', 32, 26, 44, 34, 7), seg: 6, friction: 0.2 },
    ],
    details: [
      ...toes(-42, 36, '#e57aa3', 4), ...toes(46, 36, '#e57aa3', 6),
      polySeg(2, '#fbd0df', [36, 0], [50, 1.5], [50, 4.5], [36, 4]),
      polySeg(7, '#fbd0df', [50, 1.5], [64, 3], [64, 6], [50, 4.5]),
    ],
    face: { x: -40, y: 0, r: 14, seg: 0 },
    // Only the body has to come to rest: the floppy head, tail and legs do not hold up the game.
    settleSegments: [1],
    joints: [
      // A wobbly neck: soft and only lightly damped, so the head jiggles like jelly.
      { a: 0, b: 1, x: -26, y: 4, hz: 1.2, damping: 0.4 },
      // The tail swings fairly freely on both joints: a long way down, part of the way up.
      { a: 1, b: 2, x: 31, y: 6, hinge: [-0.6, 1.2], loose: true },
      { a: 2, b: 7, x: 50, y: 6, hinge: [-0.6, 1.0], loose: true },
      // Legs dangle from the hip. While falling they only bend outwards (the front leg to the left,
      // the back leg to the right), so they never tuck in under the body; once landed they turn
      // almost all the way round outwards but only a little inwards, so they mostly splay out.
      { a: 1, b: 3, x: -20, y: 16, hinge: [-0.5, 0], landed: [-2.6, 0.25], loose: true },
      { a: 3, b: 4, x: -28, y: 26, hinge: [-0.8, 0], landed: [-2.6, 0.3], loose: true },
      { a: 1, b: 5, x: 24, y: 16, hinge: [0, 0.5], landed: [-0.25, 2.6], loose: true },
      { a: 5, b: 6, x: 32, y: 26, hinge: [0, 0.8], landed: [-0.3, 2.6], loose: true },
    ],
  },
  {
    id: 'dokudami', name: 'どくだみ',
    parts: [
      // Short stem with the leaves spread low: a wide, steady base.
      rect(0, 3, 6, 18, '#4f8a3a', 3),
      poly('#3f8a3a', [-4, 0], [-26, -10], [-36, 4], [-26, 14], [-6, 12]),
      poly('#3f8a3a', [4, 0], [26, -10], [36, 4], [26, 14], [6, 12]),
      circle(0, -38, 10, '#ffffff'), circle(0, -10, 10, '#ffffff'),
      circle(-14, -24, 10, '#ffffff'), circle(14, -24, 10, '#ffffff'),
      circle(0, -24, 11, '#f2e27a'),
    ],
    face: { x: 0, y: -24, r: 11 },
  },
  {
    // One foxtail (ねこじゃらし) growing from a little tuft that holds the face.
    id: 'weed', name: 'ざっそう',
    parts: [
      limb('#7a9a2e', 0, 6, 4, -44, 4),
      capsule('#b9c94a', 4, -42, 10, -76, 14),
      circle(0, 18, 16, '#6aa33a'),
    ],
    details: fuzz(4, -42, 10, -76),
    face: { x: 0, y: 18, r: 13 },
  },
  {
    // Like a bat emblem: wings spread wide, standing on the pointed wing tips.
    id: 'flyingfox', name: 'おおこうもり',
    parts: [
      poly('#2f2630', [-8, -16], [-40, -26], [-64, -12], [-62, 30], [-10, 12]),
      poly('#2f2630', [8, -16], [40, -26], [64, -12], [62, 30], [10, 12]),
      rect(0, 2, 24, 34, '#6b4a34', 11),
      circle(0, -20, 15, '#8a5a3a'),
      poly('#8a5a3a', [-13, -30], [-11, -44], [-4, -33]),
      poly('#8a5a3a', [4, -33], [11, -44], [13, -30]),
    ],
    details: [
      // Wing bones.
      limb('#5a4e5c', -12, -12, -60, 26, 2), limb('#5a4e5c', -12, -12, -40, -22, 2), limb('#5a4e5c', -12, -8, -36, 18, 2),
      limb('#5a4e5c', 12, -12, 60, 26, 2), limb('#5a4e5c', 12, -12, 40, -22, 2), limb('#5a4e5c', 12, -8, 36, 18, 2),
    ],
    face: { x: 0, y: -20, r: 12 },
  },
  {
    id: 'redpanda', name: 'れっさーぱんだ',
    parts: [
      rect(6, 10, 58, 26, '#c1502e', 12),
      rect(-16, 28, 10, 14, '#3a2420', 4), rect(24, 28, 10, 14, '#3a2420', 4),
      circle(-30, -8, 18, '#c1502e'),
      poly('#c1502e', [-46, -14], [-46, -33], [-35, -24]),
      poly('#c1502e', [-25, -24], [-14, -33], [-14, -14]),
      rect(44, 0, 12, 34, '#c1502e', 6),
    ],
    details: [rect(44, -6, 12, 5, '#e8c9a8', 2), rect(44, 6, 12, 5, '#e8c9a8', 2)],
    face: { x: -30, y: -7, r: 14 },
  },
  {
    id: 'squirrel', name: 'りす',
    parts: [
      circle(26, -16, 22, '#c98a50'),
      circle(-2, 14, 16, '#b5743d'),
      circle(-14, -10, 17, '#b5743d'),
      circle(-26, -27, 6, '#b5743d'),
      circle(-4, -29, 6, '#b5743d'),
      rect(-12, 28, 10, 8, '#8f5a2c', 4), rect(8, 28, 10, 8, '#8f5a2c', 4),
    ],
    details: [
      circle(-26, -27, 3, '#f2c9a0'), circle(-4, -29, 3, '#f2c9a0'),
      rect(-2, 18, 14, 16, '#f0d8b4', 7),
      // A curly, swirly tail.
      ...spiral(26, -16, 17, 2.2, '#8f5a2c'),
    ],
    face: { x: -14, y: -10, r: 13 },
  },
  {
    id: 'capybara', name: 'かぴばら',
    parts: [
      rect(6, 6, 76, 38, '#d9b97f', 16),
      rect(-40, -8, 34, 32, '#d9b97f', 12),
      circle(-32, -27, 5, '#b8945a'),
      rect(-16, 28, 12, 12, '#b8945a', 4), rect(28, 28, 12, 12, '#b8945a', 4),
    ],
    face: { x: -40, y: -8, r: 13 },
  },
  {
    // Petals all round a brown centre, like a picture-book sunflower.
    id: 'sunflower', name: 'ひまわり',
    parts: [...petals(14, 21, 42, 13, '#ffd84d', '#f6c12e'), circle(0, 0, 23, '#c98a3a')],
    details: seedGrid(23, '#7a4a1e'),
    face: { x: 0, y: 0, r: 19 },
  },
  {
    // A photo of a person (しげみ). Collision follows the photo's outline: a stack of convex
    // pieces traced from its transparency (arm and phone, head, body and bag, both legs, shoes).
    id: 'shigemi', name: 'しげみ',
    parts: [
      sil([-13.3, -38.9], [-12.2, -39.9], [1.8, -50], [3.9, -50], [6.9, -49], [6.9, -46], [5.9, -39.9], [4.9, -37.9], [-13.3, -37.9]),
      sil([11.9, -43], [12.9, -44], [19, -46], [25, -46], [27, -45], [29, -43], [30, -39.9], [30, -37.9], [12.9, -37.9], [11.9, -41.9]),
      sil([-19.3, -33.9], [-17.3, -35.9], [-12.2, -39.9], [30, -39.9], [30, -35.9], [26, -25.8], [-18.3, -25.8], [-19.3, -26.8]),
      sil([-24.3, -16.8], [-19.3, -27.9], [26, -27.9], [26, -25.8], [25, -17.8], [24, -15.8], [-24.3, -15.8]),
      sil([-33.4, -7.7], [-23.3, -17.8], [24, -17.8], [24, -15.8], [23, -7.7], [22, -5.7], [-33.4, -5.7]),
      sil([-33.4, -7.7], [22, -7.7], [22, -5.7], [14.9, 9.4], [-21.3, 9.4], [-25.3, 5.4], [-33.4, -5.7]),
      sil([-22.3, 7.4], [-10.2, 7.4], [-8.2, 20.5], [-8.2, 21.5], [-9.2, 24.5], [-10.2, 26.5], [-21.3, 26.5], [-22.3, 8.4]),
      sil([-3.2, 7.4], [13.9, 7.4], [14.9, 8.4], [19, 13.4], [20, 15.4], [20, 20.5], [19, 24.5], [18, 26.5], [9.9, 26.5], [-3.2, 8.4]),
      sil([-23.3, 38.6], [-21.3, 24.5], [-10.2, 24.5], [-10.2, 26.5], [-15.3, 40.6], [-23.3, 40.6]),
      sil([8.9, 31.5], [9.9, 24.5], [18, 24.5], [24, 39.6], [24, 40.6], [11.9, 40.6], [9.9, 39.6], [8.9, 38.6]),
      sil([-23.3, 38.6], [-15.3, 38.6], [-15.3, 47.7], [-16.3, 49.7], [-18.3, 50.7], [-20.3, 50.7], [-22.3, 49.7], [-23.3, 48.7]),
      sil([9.9, 38.6], [23, 38.6], [24, 39.6], [24, 43.6], [23, 44.6], [16.9, 44.6], [9.9, 39.6]),
    ],
    sprite: { x: -35.4, y: -50, w: 70.8, h: 100 },
  },
  {
    id: 'leaf', name: 'はっぱ',
    parts: [
      poly('#58b04a', [-40, 0], [-22, -18], [6, -22], [32, -11], [40, 0], [32, 11], [6, 22], [-22, 18]),
      rect(-46, 2, 14, 4, '#3f8a3a', 2),
    ],
    details: [rect(4, 0, 64, 2, '#3f8a3a', 1)],
    face: { x: 2, y: 0, r: 13 },
  },
];

const RAW_BUS: PieceDef = {
  id: 'bus', name: 'バス',
  parts: [
    rect(0, 0, 168, 56, '#c3cbd3', 10),
    wheel(-48, 26, 11, '#222222'), wheel(48, 26, 11, '#222222'),
  ],
  details: [
    rect(0, -9, 150, 22, '#cfe8f7', 4),
    rect(0, 10, 160, 5, '#7d8893', 2),
    circle(-48, 26, 4, '#bbbbbb'), circle(48, 26, 4, '#bbbbbb'),
  ],
  // The driver, in the front (left) window.
  face: { x: -63, y: -9, r: 12 },
};

/** All pieces are drawn a little smaller than they were designed (outline width stays the same). */
export const PIECE_SCALE = 0.88;

function scaleShape(s: Shape, k: number): Shape {
  switch (s.kind) {
    case 'rect':
      return { ...s, x: s.x * k, y: s.y * k, w: s.w * k, h: s.h * k, round: (s.round ?? 0) * k };
    case 'circle':
      return { ...s, x: s.x * k, y: s.y * k, r: s.r * k };
    case 'poly':
      return { ...s, points: s.points.map(([x, y]) => [x * k, y * k] as [number, number]) };
  }
}

function scaleDef(d: PieceDef, k: number): PieceDef {
  return {
    ...d,
    parts: d.parts.map((s) => scaleShape(s, k)),
    details: d.details?.map((s) => scaleShape(s, k)),
    face: d.face && { ...d.face, x: d.face.x * k, y: d.face.y * k, r: d.face.r * k },
    sprite: d.sprite && { x: d.sprite.x * k, y: d.sprite.y * k, w: d.sprite.w * k, h: d.sprite.h * k },
    joints: d.joints?.map((j) => ({ ...j, x: j.x * k, y: j.y * k })),
  };
}

export const ANIMALS: PieceDef[] = RAW_ANIMALS.map((d) => scaleDef(d, PIECE_SCALE));
export const BUS: PieceDef = scaleDef(RAW_BUS, PIECE_SCALE);
export const ALL_PIECES: PieceDef[] = [...ANIMALS, BUS];

export function pieceById(id: string): PieceDef {
  const found = ALL_PIECES.find((p) => p.id === id);
  if (!found) throw new Error(`unknown piece: ${id}`);
  return found;
}

/** Number of segments (bodies) a piece is made of. */
export function segmentCount(def: PieceDef): number {
  return 1 + Math.max(0, ...def.parts.map((s) => s.seg ?? 0));
}
