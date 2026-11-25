import RAPIER from "@dimforge/rapier3d-compat";
import type { Face } from "@perudo/engine";
import { remapFaces, type Quat, type SideFaces } from "./remapFaces.ts";

/** Inner half-size of the tray the dice are thrown into (x, z); its floor is at y = 0. */
export const TRAY = { halfWidth: 4.2, halfDepth: 2.8, wallHeight: 4 };

/** Where a die is at one step of a throw. */
export interface Pose {
  position: readonly [number, number, number];
  quaternion: Quat;
}

/** A throw played out in advance: one track of poses per die, one pose per `stepSeconds`, all the same length. */
export interface ThrowRecording {
  stepSeconds: number;
  tracks: Pose[][];
  /** The Faces to paint on each die for the whole throw, so it lands showing the server's Face. */
  sides: SideFaces[];
}

const STEP_SECONDS = 1 / 60;
const GRAVITY = { x: 0, y: -30, z: 0 }; // strong gravity: dice settle quickly
const DIE_HALF = 0.5;
/** Speeds below this count as at rest. */
const REST_SPEED = 0.05;
/** Steps in a row with every die at rest before the throw counts as over. */
const REST_STEPS = 10;
/** Give up after this many steps (10 s) and keep the poses as they are; remapFaces copes with a tilted die. */
const MAX_STEPS = 600;
/** cos of the largest tilt that still counts as lying flat (about 2.5 degrees). */
const FLAT = 0.999;

/** Throws that leave a die cocked are thrown again, up to this many times; after that the last one is kept. */
const MAX_ATTEMPTS = 20;

let physicsReady: Promise<void> | undefined;

/**
 * Throws one die per Face into the tray with rapier, headlessly, and records every die's pose each step until
 * they have all come to rest. A throw that leaves a die cocked (leaning on a wall or another die) is quietly
 * thrown again, so every die ends lying flat with one side clearly up. Each die's Faces are then laid out from
 * its resting orientation so that `faces[i]` (the server's roll) is on top: shown with those Faces from the
 * start, the throw simply lands on the right number. `random` only decides how the dice fly (cosmetic, ADR-0002).
 */
export async function simulateThrow(
  faces: readonly Face[],
  random: () => number = Math.random,
): Promise<ThrowRecording> {
  await (physicsReady ??= RAPIER.init());
  let tracks = recordThrow(faces.length, random);
  for (let attempt = 1; attempt < MAX_ATTEMPTS && !tracks.every(endsFlat); attempt++) {
    tracks = recordThrow(faces.length, random);
  }
  const sides = tracks.map((track, i) => remapFaces(track.at(-1)!.quaternion, faces[i]!));
  return { stepSeconds: STEP_SECONDS, tracks, sides };
}

function recordThrow(count: number, random: () => number): Pose[][] {
  const world = new RAPIER.World(GRAVITY);
  world.timestep = STEP_SECONDS;
  try {
    addTray(world);
    const dice = Array.from({ length: count }, (_, i) => throwDie(world, i, count, random));
    const tracks: Pose[][] = dice.map(() => []);
    const record = () => dice.forEach((die, i) => tracks[i]!.push(poseOf(die)));
    record();
    let restSteps = 0;
    for (let step = 0; step < MAX_STEPS && restSteps < REST_STEPS; step++) {
      world.step();
      record();
      restSteps = dice.every(atRest) ? restSteps + 1 : 0;
    }
    return tracks;
  } finally {
    world.free();
  }
}

/** Whether a die's last pose lies flat on the floor: low enough, and one local axis (nearly) vertical. */
function endsFlat(track: Pose[]): boolean {
  const { position, quaternion: q } = track.at(-1)!;
  // World-Y component of each rotated local axis (as in upSide).
  const ys = [2 * (q.x * q.y + q.w * q.z), 1 - 2 * (q.x * q.x + q.z * q.z), 2 * (q.y * q.z - q.w * q.x)];
  return position[1] < DIE_HALF + 0.02 && Math.max(...ys.map(Math.abs)) > FLAT;
}

function addTray(world: RAPIER.World) {
  const { halfWidth, halfDepth, wallHeight } = TRAY;
  const t = 0.5; // wall half-thickness
  const wall = (hx: number, hy: number, hz: number, x: number, y: number, z: number) =>
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(0.9).setRestitution(0.2),
    );
  wall(halfWidth + 2 * t, t, halfDepth + 2 * t, 0, -t, 0); // floor
  wall(t, wallHeight, halfDepth + 2 * t, -halfWidth - t, wallHeight, 0);
  wall(t, wallHeight, halfDepth + 2 * t, halfWidth + t, wallHeight, 0);
  wall(halfWidth + 2 * t, wallHeight, t, 0, wallHeight, -halfDepth - t);
  wall(halfWidth + 2 * t, wallHeight, t, 0, wallHeight, halfDepth + t);
  wall(halfWidth + 2 * t, t, halfDepth + 2 * t, 0, 2 * wallHeight + t, 0); // lid, so a wild bounce never leaves
}

/** Drops die `index` of `count` at the front of the tray and flings it towards the back with a spin. */
function throwDie(world: RAPIER.World, index: number, count: number, random: () => number): RAPIER.RigidBody {
  const between = (min: number, max: number) => min + random() * (max - min);
  const spread = Math.min(TRAY.halfWidth - 1, count * 0.7);
  const x = count > 1 ? -spread + (2 * spread * index) / (count - 1) : 0;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x + between(-0.2, 0.2), between(2.5, 4), TRAY.halfDepth - 0.8)
      .setRotation(randomRotation(random))
      .setLinearDamping(0.3)
      .setAngularDamping(0.3)
      .setCcdEnabled(true),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(DIE_HALF, DIE_HALF, DIE_HALF).setRestitution(0.3).setFriction(0.8),
    body,
  );
  body.applyImpulse({ x: between(-1.5, 1.5), y: between(1, 3), z: -between(5, 9) }, true);
  body.applyTorqueImpulse({ x: between(-0.6, 0.6), y: between(-0.6, 0.6), z: between(-0.6, 0.6) }, true);
  return body;
}

/** A uniformly random rotation (Shoemake's method). */
function randomRotation(random: () => number): Quat {
  const [u, v, w] = [random(), random(), random()];
  const a = Math.sqrt(1 - u);
  const b = Math.sqrt(u);
  return {
    x: a * Math.sin(2 * Math.PI * v),
    y: a * Math.cos(2 * Math.PI * v),
    z: b * Math.sin(2 * Math.PI * w),
    w: b * Math.cos(2 * Math.PI * w),
  };
}

function atRest(body: RAPIER.RigidBody): boolean {
  if (body.isSleeping()) return true;
  const v = body.linvel();
  const w = body.angvel();
  return Math.hypot(v.x, v.y, v.z) < REST_SPEED && Math.hypot(w.x, w.y, w.z) < REST_SPEED;
}

function poseOf(body: RAPIER.RigidBody): Pose {
  const p = body.translation();
  const q = body.rotation();
  return { position: [p.x, p.y, p.z], quaternion: { x: q.x, y: q.y, z: q.z, w: q.w } };
}

/**
 * Where die `die` is `seconds` into playing `recording` back: interpolated between the two recorded steps around
 * that moment, and exactly the last recorded pose (the one its Faces were painted for) from the end onwards.
 */
export function poseAt(recording: ThrowRecording, die: number, seconds: number): Pose {
  const track = recording.tracks[die]!;
  const at = Math.max(0, seconds / recording.stepSeconds);
  const step = Math.floor(at);
  if (step >= track.length - 1) return track.at(-1)!;
  const t = at - step;
  const a = track[step]!;
  if (t === 0) return a;
  const b = track[step + 1]!;
  const [ax, ay, az] = a.position;
  const [bx, by, bz] = b.position;
  return {
    position: [ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t],
    quaternion: nlerp(a.quaternion, b.quaternion, t),
  };
}

/** Normalised linear interpolation between rotations: close enough to slerp for the small turn in one step. */
function nlerp(a: Quat, b: Quat, t: number): Quat {
  const sign = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w < 0 ? -1 : 1; // take the short way round
  const x = a.x + (sign * b.x - a.x) * t;
  const y = a.y + (sign * b.y - a.y) * t;
  const z = a.z + (sign * b.z - a.z) * t;
  const w = a.w + (sign * b.w - a.w) * t;
  const length = Math.hypot(x, y, z, w);
  return { x: x / length, y: y / length, z: z / length, w: w / length };
}
