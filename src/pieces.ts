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
    id: 'elephant', name: 'ぞう',
    parts: [
      rect(0, 5, 80, 46, '#9aa3ad', 12),
      rect(-26, 36, 16, 18, '#8a929c', 4), rect(26, 36, 16, 18, '#8a929c', 4),
      circle(-40, -14, 22, '#9aa3ad'),
      rect(-58, 10, 11, 34, '#9aa3ad', 5),
    ],
    details: [poly('#b9c0c8', [-30, -26], [-18, -30], [-14, -6], [-26, 0])],
    face: { x: -40, y: -14, r: 15 },
  },
  {
    id: 'giraffe', name: 'きりん',
    parts: [
      rect(10, 30, 56, 28, '#f2c14e', 10),
      rect(-10, 54, 10, 22, '#e0ad3a', 3), rect(30, 54, 10, 22, '#e0ad3a', 3),
      rect(-16, -10, 15, 62, '#f2c14e', 6),
      circle(-18, -48, 15, '#f2c14e'),
    ],
    details: [circle(4, 26, 5, '#b9792b'), circle(22, 34, 5, '#b9792b'), circle(-16, 2, 4, '#b9792b')],
    face: { x: -18, y: -48, r: 11 },
  },
  {
    id: 'penguin', name: 'ぺんぎん',
    parts: [rect(0, 2, 46, 66, '#2d3a4a', 22), rect(0, 36, 38, 6, '#f2a33a', 3)],
    details: [rect(0, 12, 28, 40, '#f4f4f4', 14)],
    face: { x: 0, y: -14, r: 13 },
  },
  {
    id: 'rabbit', name: 'うさぎ',
    parts: [
      circle(0, 14, 24, '#f5f0e8'), circle(0, -18, 16, '#f5f0e8'),
      rect(-7, -44, 9, 28, '#f5f0e8', 4), rect(7, -44, 9, 28, '#f5f0e8', 4),
    ],
    details: [rect(-7, -44, 4, 20, '#f6c4cc', 2), rect(7, -44, 4, 20, '#f6c4cc', 2)],
    face: { x: 0, y: -18, r: 12 },
  },
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
    id: 'dog', name: 'いぬ',
    parts: [
      rect(6, 10, 60, 28, '#c98b5a', 10),
      rect(-14, 30, 10, 14, '#b77a4b', 3), rect(26, 30, 10, 14, '#b77a4b', 3),
      circle(-26, -14, 17, '#c98b5a'),
      rect(-40, -10, 9, 22, '#8f5d36', 4),
      rect(40, -2, 7, 18, '#c98b5a', 3),
    ],
    face: { x: -24, y: -14, r: 12 },
  },
  {
    id: 'bear', name: 'くま',
    parts: [
      circle(0, 14, 30, '#7a5232'), circle(0, -26, 20, '#7a5232'),
      circle(-16, -42, 7, '#7a5232'), circle(16, -42, 7, '#7a5232'),
    ],
    details: [circle(0, 18, 16, '#a07450')],
    face: { x: 0, y: -26, r: 14 },
  },
  {
    id: 'pig', name: 'ぶた',
    parts: [
      rect(4, 4, 68, 40, '#f4a9b8', 18),
      rect(-18, 28, 12, 12, '#e891a3', 3), rect(24, 28, 12, 12, '#e891a3', 3),
      circle(-32, -6, 18, '#f4a9b8'),
    ],
    face: { x: -32, y: -6, r: 13 },
  },
  {
    id: 'cow', name: 'うし',
    parts: [
      rect(4, 4, 80, 40, '#ffffff', 8),
      rect(-24, 32, 12, 18, '#e6e6e6', 3), rect(32, 32, 12, 18, '#e6e6e6', 3),
      rect(-42, -12, 28, 30, '#ffffff', 8),
      poly('#d9c39a', [-56, -26], [-52, -36], [-48, -26]),
      poly('#d9c39a', [-36, -26], [-32, -36], [-28, -26]),
    ],
    details: [circle(10, -2, 9, '#333'), circle(30, 14, 7, '#333'), circle(-8, 16, 6, '#333')],
    face: { x: -42, y: -10, r: 12 },
  },
  {
    id: 'horse', name: 'うま',
    parts: [
      rect(10, 6, 66, 30, '#8b5a2b', 10),
      rect(-14, 32, 10, 24, '#774a22', 3), rect(34, 32, 10, 24, '#774a22', 3),
      poly('#8b5a2b', [-30, -28], [-16, -34], [-4, 0], [-22, 10]),
      rect(-30, -36, 28, 20, '#8b5a2b', 7),
    ],
    details: [rect(-12, -22, 6, 26, '#4a2c12', 3)],
    face: { x: -32, y: -36, r: 11 },
  },
  {
    id: 'sheep', name: 'ひつじ',
    parts: [
      circle(0, 0, 26, '#eeeeee'), circle(-18, 6, 16, '#eeeeee'), circle(18, 6, 16, '#eeeeee'),
      rect(-12, 28, 8, 14, '#555555', 3), rect(12, 28, 8, 14, '#555555', 3),
      circle(-32, -10, 13, '#555555'),
    ],
    face: { x: -32, y: -10, r: 10 },
  },
  {
    id: 'monkey', name: 'さる',
    parts: [
      circle(0, 14, 22, '#a0703c'), circle(0, -18, 18, '#a0703c'),
      circle(-19, -18, 7, '#a0703c'), circle(19, -18, 7, '#a0703c'),
      rect(24, 22, 26, 7, '#a0703c', 3),
    ],
    details: [circle(0, 16, 12, '#d9a877')],
    face: { x: 0, y: -16, r: 13 },
  },
  {
    id: 'frog', name: 'かえる',
    parts: [
      poly('#5fb85a', [-36, 20], [36, 20], [26, -8], [-26, -8]),
      circle(-16, -12, 9, '#5fb85a'), circle(16, -12, 9, '#5fb85a'),
    ],
    details: [circle(-16, -14, 4, '#222'), circle(16, -14, 4, '#222')],
    face: { x: 0, y: 6, r: 11 },
  },
  {
    id: 'turtle', name: 'かめ',
    parts: [
      poly('#3f7a3f', [-36, 10], [36, 10], [28, -10], [10, -20], [-10, -20], [-28, -10]),
      circle(-42, 4, 12, '#7cb36a'),
      rect(-22, 15, 12, 10, '#7cb36a', 3), rect(22, 15, 12, 10, '#7cb36a', 3),
    ],
    details: [poly('#5a9a5a', [-12, -14], [12, -14], [18, 2], [-18, 2])],
    face: { x: -42, y: 4, r: 9 },
  },
  {
    id: 'crocodile', name: 'わに',
    parts: [
      rect(0, 0, 100, 22, '#4f8a4b', 8),
      rect(-62, 4, 34, 14, '#4f8a4b', 4),
      rect(-26, 14, 10, 10, '#447a40', 2), rect(26, 14, 10, 10, '#447a40', 2),
      poly('#4f8a4b', [50, -8], [78, 0], [50, 8]),
    ],
    face: { x: -50, y: -6, r: 9 },
  },
  {
    id: 'panda', name: 'ぱんだ',
    parts: [
      circle(0, 14, 28, '#ffffff'), circle(0, -24, 19, '#ffffff'),
      circle(-15, -39, 7, '#222222'), circle(15, -39, 7, '#222222'),
    ],
    details: [rect(0, 8, 56, 12, '#222222', 6)],
    face: { x: 0, y: -24, r: 14 },
  },
  {
    id: 'lion', name: 'らいおん',
    parts: [
      rect(12, 10, 62, 30, '#e0a030', 12),
      rect(-6, 30, 10, 14, '#c98b25', 3), rect(32, 30, 10, 14, '#c98b25', 3),
      circle(-24, -12, 22, '#a0521c'),
      rect(46, 0, 8, 20, '#e0a030', 3),
    ],
    face: { x: -24, y: -12, r: 14 },
  },
  {
    id: 'fox', name: 'きつね',
    parts: [
      rect(8, 10, 50, 26, '#e8833a', 12),
      poly('#e8833a', [-42, -24], [-12, -24], [-24, 6]),
      poly('#e8833a', [-42, -24], [-40, -40], [-30, -24]),
      poly('#e8833a', [-24, -24], [-14, -40], [-12, -24]),
      circle(40, 2, 13, '#e8833a'),
    ],
    details: [circle(46, -2, 6, '#ffffff')],
    face: { x: -26, y: -14, r: 10 },
  },
  {
    id: 'chicken', name: 'にわとり',
    parts: [
      circle(0, 8, 22, '#ffffff'), circle(-12, -20, 13, '#ffffff'),
      poly('#e23b3b', [-20, -32], [-12, -42], [-4, -32]),
      poly('#f2b233', [-26, -22], [-34, -18], [-26, -14]),
      rect(-6, 32, 4, 10, '#f2b233'), rect(6, 32, 4, 10, '#f2b233'),
    ],
    face: { x: -12, y: -20, r: 10 },
  },
  {
    id: 'whale', name: 'くじら',
    parts: [
      rect(0, 0, 96, 40, '#4a7fb5', 20),
      poly('#4a7fb5', [44, -4], [66, -22], [66, 14]),
    ],
    details: [rect(-4, 12, 70, 10, '#cfe2f3', 5)],
    face: { x: -28, y: -4, r: 13 },
  },
];

export const BUS: PieceDef = {
  id: 'bus', name: 'バス',
  parts: [
    rect(0, 0, 168, 56, '#e6403a', 10),
    circle(-48, 26, 11, '#222222'), circle(48, 26, 11, '#222222'),
  ],
  details: [
    rect(0, -10, 150, 18, '#cfe8f7', 4),
    rect(0, 8, 160, 5, '#ffffff', 2),
    circle(-48, 26, 4, '#bbbbbb'), circle(48, 26, 4, '#bbbbbb'),
  ],
};

export const ALL_PIECES: PieceDef[] = [...ANIMALS, BUS];

export function pieceById(id: string): PieceDef {
  const found = ALL_PIECES.find((p) => p.id === id);
  if (!found) throw new Error(`unknown piece: ${id}`);
  return found;
}
