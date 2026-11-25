import type { Face } from "@perudo/engine";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";
import { Die } from "./Die.tsx";
import { poseAt, simulateThrow, TRAY, type ThrowRecording } from "./simulateThrow.ts";

/** Longest frame the playback advances by, so a stalled frame slows the throw down instead of skipping it. */
const MAX_FRAME_SECONDS = 0.1;

/**
 * The viewer's own dice thrown into a tray. Remount (via `key`) to throw again; `faces` is read once per mount.
 * The throw is simulated with physics before anything is shown, and each die is painted so the server's Face
 * ends on top (ADR-0002); the recording is then played back, so the dice simply land on the right numbers.
 */
export function ThrownDice({ faces }: { faces: readonly Face[] }) {
  const [recording, setRecording] = useState<ThrowRecording | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let current = true;
    simulateThrow(faces).then(
      (r) => current && setRecording(r),
      (e: unknown) => current && setError(e ?? new Error("Dice simulation failed")),
    );
    return () => {
      current = false;
    };
    // Thrown once per mount (a new Round remounts this with a new key), not whenever a view update
    // hands over an equal `faces` array.
  }, []);

  if (error) throw error; // to the scene's error boundary, which falls back to the HTML dice

  return (
    <>
      <TrayFloor />
      {recording?.tracks.map((_, i) => <PlayedBackDie key={i} recording={recording} index={i} />)}
    </>
  );
}

function TrayFloor() {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2 * TRAY.halfWidth, 2 * TRAY.halfDepth]} />
      <meshStandardMaterial color="#1f5a3a" roughness={0.95} />
    </mesh>
  );
}

/** One die following its recorded track, already showing the Faces it will land with. */
function PlayedBackDie({ recording, index }: { recording: ThrowRecording; index: number }) {
  const group = useRef<Group>(null);
  const elapsed = useRef(0);
  const start = recording.tracks[index]![0]!;

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    elapsed.current += Math.min(delta, MAX_FRAME_SECONDS);
    const { position, quaternion: q } = poseAt(recording, index, elapsed.current);
    g.position.set(...position);
    g.quaternion.set(q.x, q.y, q.z, q.w);
  });

  const q = start.quaternion;
  return (
    <group ref={group} position={start.position} quaternion={[q.x, q.y, q.z, q.w]}>
      <Die sides={recording.sides[index]!} />
    </group>
  );
}
