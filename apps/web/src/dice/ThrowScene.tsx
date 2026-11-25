import type { Face } from "@perudo/engine";
import { DiceStage } from "./DiceStage.tsx";
import { ThrownDice } from "./ThrownDice.tsx";

/**
 * Lazy-loaded entry (keeps three.js and rapier out of the main bundle): the viewer's dice thrown.
 * Renders on demand: frames are drawn while the throw plays back, then the canvas idles.
 */
export default function ThrowScene({ faces, throwKey }: { faces: readonly Face[]; throwKey: string }) {
  return (
    <DiceStage frameloop="demand">
      <ThrownDice key={throwKey} faces={faces} />
    </DiceStage>
  );
}
