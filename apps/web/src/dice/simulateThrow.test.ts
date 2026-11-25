import type { Face } from "@perudo/engine";
import { describe, expect, test } from "vitest";
import type { Quat } from "./remapFaces.ts";
import { poseAt, simulateThrow, TRAY, type Pose } from "./simulateThrow.ts";

describe("simulateThrow", () => {
  test("every die's track ends at rest, lying flat on the tray floor inside the tray", async () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const count of [1, 3, 5]) {
        const { tracks } = await simulateThrow(rollOf(count, seed), mulberry32(seed));
        expect(tracks).toHaveLength(count);
        for (const track of tracks) {
          const last = track.at(-1)!;
          const [x, y, z] = last.position;
          expect(Math.abs(x)).toBeLessThan(TRAY.halfWidth);
          expect(Math.abs(z)).toBeLessThan(TRAY.halfDepth);
          // Lying on the floor (centre half a die above it), not on another die.
          expect(y).toBeCloseTo(0.5, 1);
          // Flat, so one side clearly faces up (not cocked against a wall or another die).
          expect(Math.max(...SIDE_NORMALS.map((n) => rotate(last.quaternion, n)[1]))).toBeGreaterThan(0.99);
          // At rest: the last few frames don't move.
          for (const earlier of track.slice(-5)) expect(distance(earlier, last)).toBeLessThan(1e-2);
        }
      }
    }
  });

  test("played back, a die ends exactly on its last recorded pose and stays there", async () => {
    const recording = await simulateThrow([2, 3, 3, 6, 1], mulberry32(11));
    const duration = (recording.tracks[0]!.length - 1) * recording.stepSeconds;
    recording.tracks.forEach((track, die) => {
      expect(poseAt(recording, die, duration)).toEqual(track.at(-1));
      expect(poseAt(recording, die, duration + 5)).toEqual(track.at(-1));
      expect(poseAt(recording, die, 0)).toEqual(track[0]);
    });
  });

  test("between two recorded steps, playback lies between their poses", async () => {
    const recording = await simulateThrow([4], mulberry32(3));
    const [a, b] = [recording.tracks[0]![10]!, recording.tracks[0]![11]!];
    const halfway = poseAt(recording, 0, 10.5 * recording.stepSeconds);
    halfway.position.forEach((c, i) => expect(c).toBeCloseTo((a.position[i]! + b.position[i]!) / 2, 6));
    // Still a unit rotation, no further from either end than they are from each other.
    const q = halfway.quaternion;
    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 6);
    expect(angleBetween(q, a.quaternion)).toBeLessThanOrEqual(angleBetween(a.quaternion, b.quaternion) + 1e-6);
    expect(angleBetween(q, b.quaternion)).toBeLessThanOrEqual(angleBetween(a.quaternion, b.quaternion) + 1e-6);
  });

  test("each die comes to rest with the server's Face on top, painted on from the start", async () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const faces = rollOf(5, seed);
      const recording = await simulateThrow(faces, mulberry32(seed));
      const end = (recording.tracks[0]!.length - 1) * recording.stepSeconds;
      faces.forEach((face, die) => {
        const sides = recording.sides[die]!;
        expect(sides[sideFacingUp(poseAt(recording, die, end).quaternion)]).toBe(face);
        expect([sides[0] + sides[1], sides[2] + sides[3], sides[4] + sides[5]]).toEqual([7, 7, 7]);
      });
    }
  });
});

/** A made-up server roll of `count` dice, different per seed. */
function rollOf(count: number, seed: number): Face[] {
  const random = mulberry32(seed * 1000);
  return Array.from({ length: count }, () => (1 + Math.floor(random() * 6)) as Face);
}

/** The side (BoxGeometry order) whose outward normal points most nearly straight up. */
function sideFacingUp(q: Quat): number {
  const ups = SIDE_NORMALS.map((n) => rotate(q, n)[1]);
  return ups.indexOf(Math.max(...ups));
}

const SIDE_NORMALS: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

type V3 = [number, number, number];

/** Rotates `v` by `q` (full quaternion formula: v' = v + 2w(u x v) + 2u x (u x v)). */
function rotate(q: Quat, v: V3): V3 {
  const u: V3 = [q.x, q.y, q.z];
  const uv = cross(u, v);
  const uuv = cross(u, uv);
  return [0, 1, 2].map((i) => v[i]! + 2 * (q.w * uv[i]! + uuv[i]!)) as V3;
}

function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function angleBetween(a: Quat, b: Quat): number {
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
  return 2 * Math.acos(Math.min(1, dot));
}

function distance(a: Pose, b: Pose): number {
  const [ax, ay, az] = a.position;
  const [bx, by, bz] = b.position;
  return Math.hypot(ax - bx, ay - by, az - bz);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
