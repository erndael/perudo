import type { Face } from "@perudo/engine";
import { DiceStage } from "./DiceStage.tsx";
import { ThrownDice } from "./ThrownDice.tsx";

/** Lazy-loaded entry (keeps three.js and rapier out of the main bundle): the viewer's dice thrown. */
export default function ThrowScene({ faces, throwKey }: { faces: readonly Face[]; throwKey: string }) {
  return (
    <DiceStage>
      <ThrownDice key={throwKey} faces={faces} />
    </DiceStage>
  );
}
