import type { ThreeElements } from "@react-three/fiber";
import { faceTextures } from "./faceTextures.ts";
import type { SideFaces } from "./remapFaces.ts";

export const DIE_SIZE = 1;

type DieProps = ThreeElements["mesh"] & {
  /** Face on each side, in BoxGeometry order (see SideFaces). Use `sidesShowing(face)` for a die lying with `face` up. */
  sides: SideFaces;
  /** Glow, e.g. for dice that count toward the Bid on a reveal. */
  highlight?: boolean;
};

/** A single die mesh. No physics: wrap it in a RigidBody to throw it, or position it directly to show a fixed Face. */
export function Die({ sides, highlight = false, ...mesh }: DieProps) {
  const textures = faceTextures();
  return (
    <mesh castShadow receiveShadow {...mesh}>
      <boxGeometry args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} />
      {sides.map((face, i) => (
        <meshStandardMaterial
          key={i}
          attach={`material-${i}`}
          map={textures[face]}
          roughness={0.45}
          emissive={highlight ? "#ffb300" : "#000000"}
          emissiveIntensity={highlight ? 0.35 : 0}
        />
      ))}
    </mesh>
  );
}
