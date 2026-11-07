// Piece definitions. All coordinates are local, in logical pixels, origin near the piece centre, y down.
// Shapes made of `parts` take part in physics; `details` are drawn only.
// `face` is the circle where a face photo is placed (dummy face until an image is provided).

export type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; color: string; round?: number }
  | { kind: 'circle'; x: number; y: number; r: number; color: string }
  | { kind: 'poly'; points: [number, number][]; color: string };

export interface FaceSpot {
  x: number;
  y: number;
  r: number;
}

export interface PieceDef {
  id: string;
  name: string;
  parts: Shape[];
  details?: Shape[];
  face?: FaceSpot;
}

const rect = (x: number, y: number, w: number, h: number, color: string, round = 0): Shape => ({
  kind: 'rect', x, y, w, h, color, round,
});
const circle = (x: number, y: number, r: number, color: string): Shape => ({ kind: 'circle', x, y, r, color });
const poly = (color: string, ...points: [number, number][]): Shape => ({ kind: 'poly', points, color });

export const ANIMALS: PieceDef[] = [
  {
    id: 'cat', name: 'ねこ',
    parts: [
      rect(4, 12, 56, 30, '#f0a35e', 12),
      circle(-24, -12, 17, '#f0a35e'),
      poly('#f0a35e', [-40, -18], [-36, -38], [-26, -26]),
      poly('#f0a35e', [-22, -28], [-12, -38], [-8, -18]),
      rect(34, -6, 8, 30, '#f0a35e', 4),
    ],
    face: { x: -24, y: -12, r: 12 },
  },
  {
    id: 'dolphin', name: 'いるか',
    parts: [
      rect(0, 0, 80, 30, '#5b8fc9', 15),
      rect(-46, 5, 22, 10, '#5b8fc9', 5),
      poly('#4a7db6', [-4, -12], [10, -32], [18, -12]),
      poly('#4a7db6', [34, -4], [58, -20], [48, 2]),
      poly('#4a7db6', [34, 6], [48, -2], [58, 18]),
    ],
    details: [rect(-4, 9, 60, 9, '#d8e8f5', 4)],
    face: { x: -22, y: -1, r: 11 },
  },
  {
    id: 'bird', name: 'わたりどり',
    parts: [
      circle(4, 6, 20, '#7a6a58'),
      circle(-20, -14, 13, '#7a6a58'),
      poly('#5e5040', [-6, -6], [20, -42], [30, -32], [14, -2]),
      poly('#e0a030', [-32, -18], [-46, -13], [-32, -8]),
      poly('#5e5040', [20, 6], [42, -4], [42, 14]),
    ],
    details: [rect(2, 14, 26, 10, '#efe6d8', 5)],
    face: { x: -20, y: -14, r: 10 },
  },
  {
    id: 'leopard', name: 'めひょう',
    parts: [
      rect(6, 8, 78, 24, '#e8b84a', 12),
      rect(-22, 28, 10, 18, '#e8b84a', 4), rect(32, 28, 10, 18, '#e8b84a', 4),
      circle(-38, -6, 16, '#e8b84a'),
      poly('#e8b84a', [-52, -12], [-50, -28], [-40, -20]),
      poly('#e8b84a', [-36, -20], [-26, -28], [-24, -12]),
      rect(50, -10, 8, 30, '#e8b84a', 4),
    ],
    details: [
      circle(-10, 4, 4, '#5a3d1e'), circle(8, 12, 4, '#5a3d1e'), circle(24, 2, 4, '#5a3d1e'),
      circle(36, 14, 4, '#5a3d1e'), circle(-2, 16, 3, '#5a3d1e'),
    ],
    face: { x: -38, y: -6, r: 11 },
  },
  {
    id: 'sloth', name: 'なまけもの',
    parts: [
      circle(0, 8, 24, '#9c8466'),
      circle(0, -24, 15, '#b49a7a'),
      rect(-26, 8, 10, 36, '#9c8466', 5), rect(26, 8, 10, 36, '#9c8466', 5),
    ],
    details: [
      rect(-29, 26, 3, 8, '#3b2f22', 1), rect(-24, 26, 3, 8, '#3b2f22', 1),
      rect(24, 26, 3, 8, '#3b2f22', 1), rect(29, 26, 3, 8, '#3b2f22', 1),
    ],
    face: { x: 0, y: -24, r: 11 },
  },
  {
    id: 'axolotl', name: 'うーぱーるーぱー',
    parts: [
      rect(8, 8, 62, 22, '#f7a8c4', 11),
      circle(-30, 0, 17, '#f7a8c4'),
      poly('#e57aa3', [-40, -12], [-52, -24], [-46, -28], [-36, -16]),
      poly('#e57aa3', [-30, -16], [-32, -32], [-26, -32], [-24, -16]),
      poly('#e57aa3', [-20, -12], [-12, -26], [-8, -22], [-16, -10]),
      rect(-6, 22, 8, 10, '#f7a8c4', 3), rect(22, 22, 8, 10, '#f7a8c4', 3),
      poly('#f7a8c4', [36, 0], [60, 4], [60, 16], [36, 16]),
    ],
    face: { x: -30, y: 0, r: 11 },
  },
  {
    id: 'dokudami', name: 'どくだみ',
    parts: [
      rect(0, 22, 6, 40, '#4f8a3a', 3),
      poly('#3f8a3a', [-4, 14], [-26, 0], [-34, 16], [-24, 28], [-6, 26]),
      poly('#3f8a3a', [4, 14], [26, 0], [34, 16], [24, 28], [6, 26]),
      circle(0, -36, 9, '#ffffff'), circle(0, -12, 9, '#ffffff'),
      circle(-12, -24, 9, '#ffffff'), circle(12, -24, 9, '#ffffff'),
      circle(0, -24, 9, '#f2e27a'),
    ],
    face: { x: 0, y: -24, r: 8 },
  },
  {
    id: 'weed', name: 'ざっそう',
    parts: [
      rect(0, 22, 60, 22, '#6a9a3a', 10),
      poly('#5d9c38', [-26, 16], [-34, -24], [-14, 16]),
      poly('#4f8f2e', [-10, 14], [-2, -38], [8, 14]),
      poly('#5d9c38', [12, 16], [30, -20], [26, 18]),
    ],
    face: { x: 0, y: 22, r: 9 },
  },
  {
    id: 'flyingfox', name: 'おおこうもり',
    parts: [
      rect(0, 6, 24, 40, '#6b4a34', 11),
      circle(0, -20, 13, '#8a5a3a'),
      poly('#8a5a3a', [-12, -28], [-10, -40], [-4, -30]),
      poly('#8a5a3a', [4, -30], [10, -40], [12, -28]),
      poly('#3b2e2e', [-10, -6], [-54, -14], [-48, 16], [-10, 18]),
      poly('#3b2e2e', [10, -6], [54, -14], [48, 16], [10, 18]),
    ],
    face: { x: 0, y: -20, r: 10 },
  },
  {
    id: 'redpanda', name: 'れっさーぱんだ',
    parts: [
      rect(4, 10, 58, 26, '#c1502e', 12),
      rect(-18, 28, 10, 14, '#3a2420', 4), rect(22, 28, 10, 14, '#3a2420', 4),
      circle(-30, -8, 16, '#c1502e'),
      poly('#c1502e', [-44, -14], [-44, -30], [-34, -22]),
      poly('#c1502e', [-26, -22], [-16, -30], [-16, -14]),
      rect(42, 0, 12, 34, '#c1502e', 6),
    ],
    details: [rect(42, -6, 12, 5, '#e8c9a8', 2), rect(42, 6, 12, 5, '#e8c9a8', 2)],
    face: { x: -30, y: -6, r: 11 },
  },
  {
    id: 'squirrel', name: 'りす',
    parts: [
      circle(-4, 10, 18, '#b5743d'),
      circle(-14, -16, 12, '#b5743d'),
      poly('#b5743d', [-22, -24], [-22, -36], [-14, -28]),
      circle(20, -6, 18, '#c98a50'),
      rect(16, 14, 14, 16, '#c98a50', 6),
    ],
    details: [rect(-4, 16, 14, 14, '#ecd2b0', 6)],
    face: { x: -14, y: -16, r: 9 },
  },
  {
    id: 'capybara', name: 'かぴばら',
    parts: [
      rect(6, 6, 76, 38, '#a07a52', 16),
      rect(-38, -8, 32, 30, '#a07a52', 11),
      circle(-30, -26, 5, '#8a6542'),
      rect(-16, 28, 12, 12, '#8a6542', 4), rect(28, 28, 12, 12, '#8a6542', 4),
    ],
    face: { x: -38, y: -8, r: 11 },
  },
  {
    id: 'sunflower', name: 'ひまわり',
    parts: [
      rect(0, 30, 8, 44, '#4f8a3a', 4),
      poly('#3f8a3a', [-4, 34], [-26, 24], [-30, 32], [-6, 44]),
      poly('#3f8a3a', [4, 30], [26, 20], [30, 28], [6, 40]),
      circle(0, -16, 26, '#ffd21f'),
    ],
    details: [circle(0, -16, 16, '#8a5a2a')],
    face: { x: 0, y: -16, r: 13 },
  },
  {
    id: 'leaf', name: 'はっぱ',
    parts: [
      poly('#58b04a', [-40, 0], [-22, -16], [6, -20], [32, -10], [40, 0], [32, 10], [6, 20], [-22, 16]),
      rect(-46, 2, 14, 4, '#3f8a3a', 2),
    ],
    details: [rect(4, 0, 64, 2, '#3f8a3a', 1)],
    face: { x: 2, y: 0, r: 11 },
  },
];

export const BUS: PieceDef = {
  id: 'bus', name: 'バス',
  parts: [
    rect(0, 0, 168, 56, '#c3cbd3', 10),
    circle(-48, 26, 11, '#222222'), circle(48, 26, 11, '#222222'),
  ],
  details: [
    rect(0, -10, 150, 18, '#cfe8f7', 4),
    rect(0, 8, 160, 5, '#7d8893', 2),
    circle(-48, 26, 4, '#bbbbbb'), circle(48, 26, 4, '#bbbbbb'),
  ],
  // The driver, in the front (left) window.
  face: { x: -64, y: -10, r: 10 },
};

export const ALL_PIECES: PieceDef[] = [...ANIMALS, BUS];

export function pieceById(id: string): PieceDef {
  const found = ALL_PIECES.find((p) => p.id === id);
  if (!found) throw new Error(`unknown piece: ${id}`);
  return found;
}
