import type { Face } from "@perudo/engine";
import { describe, expect, test } from "vitest";
import { remapFaces, type Quat, type SideFaces } from "./remapFaces.ts";

const FACES: Face[] = [1, 2, 3, 4, 5, 6];
const IDENTITY: Quat = { x: 0, y: 0, z: 0, w: 1 };

describe("remapFaces", () => {
  test("a die resting upright shows the target Face on its +Y side", () => {
    for (const target of FACES) {
      const sides = remapFaces(IDENTITY, target);
      expect(sides[2]).toBe(target);
      expectOppositeSidesSumTo7(sides);
    }
  });

  test("there are exactly 24 resting orientations to check", () => {
    expect(RESTING_ORIENTATIONS).toHaveLength(24);
  });

  test("for every resting orientation and every target Face, the target is on top", () => {
    for (const q of RESTING_ORIENTATIONS) {
      for (const target of FACES) {
        const sides = remapFaces(q, target);
        expect(sides[sideFacingUp(q)]).toBe(target);
        expectOppositeSidesSumTo7(sides);
      }
    }
  });

  test("a die resting slightly tilted (e.g. leaning on another die) still shows the target on top", () => {
    const rng = mulberry32(7);
    for (const q of RESTING_ORIENTATIONS) {
      for (let n = 0; n < 20; n++) {
        const tilted = multiply(smallRotation(rng, (25 * Math.PI) / 180), q);
        for (const target of FACES) {
          expect(remapFaces(tilted, target)[sideFacingUp(tilted)]).toBe(target);
        }
      }
    }
  });

  test("dice are never mirror images: Faces 1, 2 and 3 always meet in the same turning direction", () => {
    const handedness = (sides: SideFaces) =>
      Math.sign(triple(direction(sides.indexOf(1)), direction(sides.indexOf(2)), direction(sides.indexOf(3))));
    const expected = handedness(remapFaces(IDENTITY, 1));
    for (const q of RESTING_ORIENTATIONS) {
      for (const target of FACES) {
        expect(handedness(remapFaces(q, target))).toBe(expected);
      }
    }
  });
});

// --- Independent geometry for the tests (no three.js, nothing shared with the implementation) ---

type V3 = [number, number, number];

/** Outward normal of a BoxGeometry side: 0 = +X, 1 = -X, 2 = +Y, 3 = -Y, 4 = +Z, 5 = -Z. */
function direction(side: number): V3 {
  return [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ][side] as V3;
}

function triple(a: V3, b: V3, c: V3): number {
  return a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
}

function multiply(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

/** Rotates `v` by `q` as q * v * q^-1. */
function rotate(q: Quat, v: V3): V3 {
  const p = multiply(multiply(q, { x: v[0], y: v[1], z: v[2], w: 0 }), { x: -q.x, y: -q.y, z: -q.z, w: q.w });
  return [p.x, p.y, p.z];
}

/** The side whose world-space normal points most nearly up. */
function sideFacingUp(q: Quat): number {
  let best = 0;
  for (let side = 1; side < 6; side++) if (rotate(q, direction(side))[1] > rotate(q, direction(best))[1]) best = side;
  return best;
}

function axisAngle(axis: V3, angle: number): Quat {
  const s = Math.sin(angle / 2);
  return { x: axis[0] * s, y: axis[1] * s, z: axis[2] * s, w: Math.cos(angle / 2) };
}

/** All 24 ways a cube can rest flat: closure of the identity under quarter turns about X, Y and Z. */
const RESTING_ORIENTATIONS: Quat[] = (() => {
  const quarterTurns = [axisAngle([1, 0, 0], Math.PI / 2), axisAngle([0, 1, 0], Math.PI / 2), axisAngle([0, 0, 1], Math.PI / 2)];
  const key = (q: Quat) => {
    const rounded = [q.w, q.x, q.y, q.z].map((c) => Math.round(c * 1e4) / 1e4 + 0);
    const sign = rounded.find((c) => c !== 0)! > 0 ? 1 : -1; // q and -q are the same rotation
    return rounded.map((c) => c * sign + 0).join(",");
  };
  const found = new Map<string, Quat>([[key(IDENTITY), IDENTITY]]);
  const queue = [IDENTITY];
  while (queue.length > 0) {
    const q = queue.shift()!;
    for (const turn of quarterTurns) {
      const next = multiply(turn, q);
      if (!found.has(key(next))) {
        found.set(key(next), next);
        queue.push(next);
      }
    }
  }
  return [...found.values()];
})();

function smallRotation(rng: () => number, maxAngle: number): Quat {
  const axis: V3 = [rng() - 0.5, rng() - 0.5, rng() - 0.5];
  const length = Math.hypot(...axis);
  return axisAngle(
    axis.map((c) => c / length) as V3,
    rng() * maxAngle,
  );
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expectOppositeSidesSumTo7(sides: SideFaces) {
  expect(sides[0] + sides[1]).toBe(7);
  expect(sides[2] + sides[3]).toBe(7);
  expect(sides[4] + sides[5]).toBe(7);
  expect(new Set(sides).size).toBe(6);
}
