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
}

const rect = (x: number, y: number, w: number, h: number, color: string, round = 0, seg = 0): Shape => ({
  kind: 'rect', x, y, w, h, color, round, seg,
});
const circle = (x: number, y: number, r: number, color: string, seg = 0): Shape => ({ kind: 'circle', x, y, r, color, seg });
const wheel = (x: number, y: number, r: number, color: string): Shape => ({ kind: 'circle', x, y, r, color, exact: true });
const poly = (color: string, ...points: [number, number][]): Shape => ({ kind: 'poly', points, color });
const polySeg = (seg: number, color: string, ...points: [number, number][]): Shape => ({ kind: 'poly', points, color, seg });

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

export const ANIMALS: PieceDef[] = [
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
      circle(6, 8, 20, '#7a6a58'),
      circle(-20, -14, 16, '#7a6a58'),
      poly('#5e5040', [-4, -6], [22, -42], [32, -32], [16, -2]),
      poly('#e0a030', [-35, -19], [-50, -14], [-35, -8]),
      poly('#5e5040', [22, 8], [44, -2], [44, 16]),
    ],
    details: [rect(4, 16, 26, 10, '#efe6d8', 5)],
    face: { x: -20, y: -14, r: 13 },
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
  slothDef('sloth', 'なまけもの（ちゃいろ）', '#9c8466', '#7c664b', '#c9b48f'),
  slothDef('graysloth', 'なまけもの（はいいろ）', '#9a9a8c', '#76766a', '#d0cfc0'),
  {
    // Soft: head, body and tail are joined by springy welds, so it sags a little like the real thing.
    id: 'axolotl', name: 'うーぱーるーぱー',
    parts: [
      circle(-36, 0, 18, '#f7a8c4', 0),
      polySeg(0, '#e57aa3', [-46, -12], [-60, -24], [-54, -29], [-42, -16]),
      polySeg(0, '#e57aa3', [-38, -17], [-40, -34], [-33, -34], [-31, -17]),
      polySeg(0, '#e57aa3', [-26, -13], [-17, -28], [-12, -24], [-21, -11]),
      rect(0, 6, 46, 22, '#f7a8c4', 11, 1),
      rect(-16, 22, 7, 12, '#f7a8c4', 3, 1), rect(18, 22, 7, 12, '#f7a8c4', 3, 1),
      polySeg(2, '#f7a8c4', [20, -2], [58, 2], [62, 10], [20, 16]),
    ],
    details: [...toes(-16, 30, '#e57aa3', 1), ...toes(18, 30, '#e57aa3', 1), polySeg(2, '#fbd0df', [26, 0], [56, 3], [56, 6], [26, 4])],
    face: { x: -36, y: 0, r: 14, seg: 0 },
    joints: [
      { a: 0, b: 1, x: -21, y: 4 },
      { a: 1, b: 2, x: 21, y: 6 },
    ],
  },
  {
    id: 'dokudami', name: 'どくだみ',
    parts: [
      rect(0, 24, 6, 40, '#4f8a3a', 3),
      poly('#3f8a3a', [-4, 16], [-26, 2], [-34, 18], [-24, 30], [-6, 28]),
      poly('#3f8a3a', [4, 16], [26, 2], [34, 18], [24, 30], [6, 28]),
      circle(0, -38, 10, '#ffffff'), circle(0, -10, 10, '#ffffff'),
      circle(-14, -24, 10, '#ffffff'), circle(14, -24, 10, '#ffffff'),
      circle(0, -24, 11, '#f2e27a'),
    ],
    face: { x: 0, y: -24, r: 11 },
  },
  {
    // Foxtails (ねこじゃらし) growing from a little tuft that holds the face.
    id: 'weed', name: 'ざっそう',
    parts: [
      limb('#7a9a2e', -6, 8, -16, -40, 4),
      limb('#7a9a2e', 0, 6, 2, -48, 4),
      limb('#7a9a2e', 6, 8, 16, -40, 4),
      capsule('#b9c94a', -16, -38, -26, -68, 13),
      capsule('#b9c94a', 2, -46, 3, -78, 13),
      capsule('#b9c94a', 16, -38, 26, -68, 13),
      circle(0, 18, 16, '#6aa33a'),
    ],
    details: [...fuzz(-16, -38, -26, -68), ...fuzz(2, -46, 3, -78), ...fuzz(16, -38, 26, -68)],
    face: { x: 0, y: 18, r: 13 },
  },
  {
    id: 'flyingfox', name: 'おおこうもり',
    parts: [
      rect(0, 8, 24, 40, '#6b4a34', 11),
      circle(0, -20, 15, '#8a5a3a'),
      poly('#8a5a3a', [-13, -30], [-11, -43], [-4, -33]),
      poly('#8a5a3a', [4, -33], [11, -43], [13, -30]),
      poly('#3b2e2e', [-10, -4], [-56, -12], [-50, 18], [-10, 20]),
      poly('#3b2e2e', [10, -4], [56, -12], [50, 18], [10, 20]),
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
      circle(24, -10, 19, '#c98a50'),
      circle(30, -30, 12, '#c98a50'),
      circle(-2, 14, 16, '#b5743d'),
      circle(-14, -10, 17, '#b5743d'),
      circle(-26, -27, 6, '#b5743d'),
      circle(-4, -29, 6, '#b5743d'),
      rect(-12, 28, 10, 8, '#8f5a2c', 4), rect(8, 28, 10, 8, '#8f5a2c', 4),
    ],
    details: [
      circle(-26, -27, 3, '#f2c9a0'), circle(-4, -29, 3, '#f2c9a0'),
      rect(-2, 18, 14, 16, '#f0d8b4', 7),
      rect(26, -14, 4, 20, '#e0a870', 2),
    ],
    face: { x: -14, y: -10, r: 13 },
  },
  {
    id: 'capybara', name: 'かぴばら',
    parts: [
      rect(6, 6, 76, 38, '#a07a52', 16),
      rect(-40, -8, 34, 32, '#a07a52', 12),
      circle(-32, -27, 5, '#8a6542'),
      rect(-16, 28, 12, 12, '#8a6542', 4), rect(28, 28, 12, 12, '#8a6542', 4),
    ],
    face: { x: -40, y: -8, r: 13 },
  },
  {
    // Petals all round a brown centre, like a picture-book sunflower.
    id: 'sunflower', name: 'ひまわり',
    parts: [...petals(14, 17, 36, 12, '#ffd84d', '#f6c12e'), circle(0, 0, 19, '#c98a3a')],
    details: seedGrid(19, '#7a4a1e'),
    face: { x: 0, y: 0, r: 13 },
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

export const BUS: PieceDef = {
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
