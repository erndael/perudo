import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { CanvasTexture, MathUtils, SRGBColorSpace, Vector3, type PerspectiveCamera } from "three";
import { DiceStage } from "./DiceStage.tsx";
import { Die } from "./Die.tsx";
import { sidesShowing } from "./remapFaces.ts";
import { revealColumns, revealLayout, viewSpan, type RevealGroup, type RevealLayoutPlayer } from "./revealLayout.ts";

export type RevealScenePlayer = RevealLayoutPlayer & { nickname: string };

/** Glow colour for dice that count toward the called Bid (matches the HTML `.die.counts`). */
const COUNTS_COLOUR = "#ffb300";
/** Space around the layout, as a share of the view. */
const MARGIN = 1.4;
/** Direction from the table centre to the camera: nearly straight down, so the top Faces read clearly. */
const VIEW_DIRECTION = new Vector3(0, 1, 0.2).normalize();

/**
 * Lazy-loaded entry: every player's dice laid out on the table, grouped and labelled by player,
 * with the dice the server marked as counting toward the Bid highlighted. Static, no physics.
 */
export default function RevealScene({ players }: { players: readonly RevealScenePlayer[] }) {
  return (
    <DiceStage>
      <RevealTable players={players} />
    </DiceStage>
  );
}

function RevealTable({ players }: { players: readonly RevealScenePlayer[] }) {
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  const layout = useMemo(() => revealLayout(players, revealColumns(players.length, aspect)), [players, aspect]);
  const nickname = (id: string) => players.find((p) => p.id === id)?.nickname ?? "";

  return (
    <>
      <FrameCamera span={viewSpan(layout, aspect)} />
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[layout.width + 2, layout.depth + 2]} />
        <meshStandardMaterial color="#1f5a3a" roughness={0.95} />
      </mesh>
      {layout.groups.map((group) => (
        <PlayerGroup key={group.id} group={group} nickname={nickname(group.id)} />
      ))}
    </>
  );
}

function PlayerGroup({ group, nickname }: { group: RevealGroup; nickname: string }) {
  return (
    <>
      <NameStrip label={group.label} text={nickname} />
      {group.dice.map((die, i) => (
        <group key={i} position={die.position}>
          <Die sides={sidesShowing(die.face)} highlight={die.counts} />
          {die.counts && (
            // A glowing pad under the die, so counting dice stand out even where the top face is in shade.
            <mesh position={[0, -0.49, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[1.2, 1.2]} />
              <meshStandardMaterial color={COUNTS_COLOUR} emissive={COUNTS_COLOUR} emissiveIntensity={0.8} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

/** The player's name painted flat on the table above their row of dice. */
function NameStrip({ label, text }: { label: RevealGroup["label"]; text: string }) {
  const texture = useMemo(() => drawName(text, label.width / label.depth), [text, label.width, label.depth]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[label.x, 0.01, label.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[label.width, label.depth]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function drawName(text: string, aspect: number): CanvasTexture {
  const height = 64;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(height * aspect);
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f5f0e6";
  ctx.font = `bold ${Math.round(height * 0.7)}px system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, height / 2, canvas.width);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Points the camera at the table from far enough away that `span` table units fit in view. */
function FrameCamera({ span }: { span: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    const distance = ((span / 2) * MARGIN) / Math.tan(MathUtils.degToRad(camera.fov / 2));
    camera.position.copy(VIEW_DIRECTION).multiplyScalar(distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, span]);
  return null;
}
