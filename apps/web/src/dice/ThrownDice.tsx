import type { Face } from "@perudo/engine";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef, useState } from "react";
import { Die, DIE_SIZE } from "./Die.tsx";
import { remapFaces, STANDARD_SIDES, upSide, type SideFaces } from "./remapFaces.ts";

/** Inner half-size of the tray the dice are thrown into (x, z). */
export const TRAY = { halfWidth: 4.2, halfDepth: 2.8, wallHeight: 4 };

/** Speeds below this count as at rest. */
const REST_SPEED = 0.06;
/** Frames in a row at rest before a die counts as settled. */
const REST_FRAMES = 12;
/** After this long a die is treated as settled even if it still wobbles (slow software rendering, stacked dice). */
const SETTLE_TIMEOUT_S = 6;

/**
 * The viewer's own dice thrown into a tray with physics. Remount (via `key`) to throw again.
 * Physics only decides how each die lands; once it rests, its textures are remapped so the
 * server's Face is on top (ADR-0002).
 */
export function ThrownDice({ faces }: { faces: readonly Face[] }) {
  return (
    <>
      <Tray />
      {faces.map((face, i) => (
        <ThrownDie key={i} face={face} index={i} count={faces.length} />
      ))}
    </>
  );
}

function Tray() {
  const { halfWidth, halfDepth, wallHeight } = TRAY;
  const t = 0.5; // wall half-thickness
  return (
    <RigidBody type="fixed" colliders={false} friction={0.9} restitution={0.2}>
      {/* floor */}
      <CuboidCollider args={[halfWidth + 2 * t, t, halfDepth + 2 * t]} position={[0, -t, 0]} />
      {/* walls */}
      <CuboidCollider args={[t, wallHeight, halfDepth + 2 * t]} position={[-halfWidth - t, wallHeight, 0]} />
      <CuboidCollider args={[t, wallHeight, halfDepth + 2 * t]} position={[halfWidth + t, wallHeight, 0]} />
      <CuboidCollider args={[halfWidth + 2 * t, wallHeight, t]} position={[0, wallHeight, -halfDepth - t]} />
      <CuboidCollider args={[halfWidth + 2 * t, wallHeight, t]} position={[0, wallHeight, halfDepth + t]} />
      {/* lid, so a wild bounce never leaves the tray */}
      <CuboidCollider args={[halfWidth + 2 * t, t, halfDepth + 2 * t]} position={[0, 2 * wallHeight + t, 0]} />
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2 * halfWidth, 2 * halfDepth]} />
        <meshStandardMaterial color="#1f5a3a" roughness={0.95} />
      </mesh>
    </RigidBody>
  );
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

function ThrownDie({ face, index, count }: { face: Face; index: number; count: number }) {
  const body = useRef<RapierRigidBody>(null);
  const [sides, setSides] = useState<SideFaces>(STANDARD_SIDES);
  const state = useRef({ restFrames: 0, elapsed: 0, remappedFor: -1 });

  // Cosmetic randomness only: where the die starts and how it is thrown.
  const start = useMemo(() => {
    const spread = Math.min(TRAY.halfWidth - 1, count * 0.7);
    const x = count > 1 ? -spread + (2 * spread * index) / (count - 1) : 0;
    return {
      position: [x + random(-0.2, 0.2), 2.5 + random(0, 1.5), TRAY.halfDepth - 0.8] as [number, number, number],
      rotation: [random(0, Math.PI * 2), random(0, Math.PI * 2), random(0, Math.PI * 2)] as [number, number, number],
    };
  }, [index, count]);

  useEffect(() => {
    const rb = body.current;
    if (!rb) return;
    rb.applyImpulse({ x: random(-1.5, 1.5), y: random(1, 3), z: -random(5, 9) }, true);
    rb.applyTorqueImpulse({ x: random(-0.6, 0.6), y: random(-0.6, 0.6), z: random(-0.6, 0.6) }, true);
  }, []);

  useFrame((_, delta) => {
    const rb = body.current;
    if (!rb) return;
    const s = state.current;
    s.elapsed += delta;
    const v = rb.linvel();
    const w = rb.angvel();
    const atRest = Math.hypot(v.x, v.y, v.z) < REST_SPEED && Math.hypot(w.x, w.y, w.z) < REST_SPEED;
    s.restFrames = atRest ? s.restFrames + 1 : 0;
    if (s.restFrames < REST_FRAMES && s.elapsed < SETTLE_TIMEOUT_S) return;
    // Settled. Remap once, and again only if a later knock leaves a different side up.
    const q = rb.rotation();
    const top = upSide(q);
    if (top !== s.remappedFor) {
      s.remappedFor = top;
      setSides(remapFaces(q, face));
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      ccd
      position={start.position}
      rotation={start.rotation}
      restitution={0.3}
      friction={0.8}
      linearDamping={0.3}
      angularDamping={0.3}
    >
      <CuboidCollider args={[DIE_SIZE / 2, DIE_SIZE / 2, DIE_SIZE / 2]} />
      <Die sides={sides} />
    </RigidBody>
  );
}
