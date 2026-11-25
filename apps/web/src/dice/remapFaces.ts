import type { Face } from "@perudo/engine";

/** A rotation quaternion, as rapier's `RigidBody.rotation()` returns it. */
export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * The Face on each side of a die, indexed like three.js `BoxGeometry` material groups:
 * 0 = +X, 1 = -X, 2 = +Y, 3 = -Y, 4 = +Z, 5 = -Z. Opposite sides are `i` and `i ^ 1`.
 */
export type SideFaces = readonly [Face, Face, Face, Face, Face, Face];

type Vec = readonly [number, number, number];
type Matrix = readonly [Vec, Vec, Vec];

/** The layout every die starts with: opposite sides sum to 7, and every remapped die keeps its handedness. */
export const STANDARD_SIDES: SideFaces = [3, 4, 1, 6, 2, 5];

/** Outward direction of side `i` in the die's own frame. */
function sideDirection(side: number): Vec {
  const v: [number, number, number] = [0, 0, 0];
  v[side >> 1] = side & 1 ? -1 : 1;
  return v;
}

function sideOf(v: Vec): number {
  const axis = v.findIndex((c) => c !== 0);
  return axis * 2 + (v[axis]! > 0 ? 0 : 1);
}

function apply(m: Matrix, v: Vec): Vec {
  return [0, 1, 2].map((r) => m[r]![0] * v[0] + m[r]![1] * v[1] + m[r]![2] * v[2]) as unknown as Vec;
}

function determinant(m: Matrix): number {
  const [a, b, c] = m;
  return a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
}

/** The 24 rotations of a cube: signed permutation matrices with determinant +1. */
const CUBE_ROTATIONS: Matrix[] = (() => {
  const permutations = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  const rotations: Matrix[] = [];
  for (const p of permutations) {
    for (let signs = 0; signs < 8; signs++) {
      const m = p.map((col, row) => {
        const r: [number, number, number] = [0, 0, 0];
        r[col] = signs & (1 << row) ? -1 : 1;
        return r;
      }) as unknown as Matrix;
      if (determinant(m) === 1) rotations.push(m);
    }
  }
  return rotations;
})();

/** The side (0..5) of a die in orientation `q` whose outward normal points most nearly straight up (+Y). */
export function upSide(q: Quat): number {
  // World-Y component of each rotated local axis.
  const ys = [2 * (q.x * q.y + q.w * q.z), 1 - 2 * (q.x * q.x + q.z * q.z), 2 * (q.y * q.z - q.w * q.x)];
  let axis = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(ys[i]!) > Math.abs(ys[axis]!)) axis = i;
  return axis * 2 + (ys[axis]! > 0 ? 0 : 1);
}

const UPRIGHT: Quat = { x: 0, y: 0, z: 0, w: 1 };

/** Sides for an unrotated die showing `face` on top (+Y): for dice laid out without physics, e.g. a reveal. */
export function sidesShowing(face: Face): SideFaces {
  return remapFaces(UPRIGHT, face);
}

/**
 * Which Face goes on which side of a die resting in orientation `q` so that `target` is on top
 * (ADR-0002: physics only decides the orientation, the server decides the Face). The result is
 * the standard layout turned rigidly, so opposite sides still sum to 7 and the die is never mirrored.
 */
export function remapFaces(q: Quat, target: Face): SideFaces {
  const top = sideDirection(upSide(q));
  const from = sideDirection(STANDARD_SIDES.indexOf(target));
  const rotation = CUBE_ROTATIONS.find((m) => sideOf(apply(m, from)) === sideOf(top))!;
  const sides: Face[] = [];
  STANDARD_SIDES.forEach((face, side) => {
    sides[sideOf(apply(rotation, sideDirection(side)))] = face;
  });
  return sides as unknown as SideFaces;
}
