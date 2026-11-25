import type { Face } from "@perudo/engine";
import { Component, lazy, Suspense, useState, type ReactNode } from "react";

import type { RevealScenePlayer } from "./RevealScene.tsx";

const ThrowScene = lazy(() => import("./ThrowScene.tsx"));
const RevealScene = lazy(() => import("./RevealScene.tsx"));

/** Whether this browser can render WebGL at all (checked once). */
export const webglAvailable: boolean = (() => {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
})();

/**
 * Whether the 3D view is running. Starts as `webglAvailable` and drops to false if the scene crashes,
 * so callers can show the HTML dice instead.
 */
export function use3D(): [boolean, () => void] {
  const [on, setOn] = useState(webglAvailable);
  return [on, () => setOn(false)];
}

/** The viewer's own dice thrown in 3D. `throwKey` changes whenever the dice should be thrown again (a new Round). */
export function YourDice3D({ faces, throwKey, onFail }: { faces: readonly Face[]; throwKey: string; onFail: () => void }) {
  return (
    <SceneBoundary onFail={onFail}>
      <Suspense fallback={null}>
        <ThrowScene faces={faces} throwKey={throwKey} />
      </Suspense>
    </SceneBoundary>
  );
}

/** Every player's dice laid out in 3D at the end of a Round, counting dice (as marked by the server) highlighted. */
export function Reveal3D({ players, onFail }: { players: readonly RevealScenePlayer[]; onFail: () => void }) {
  return (
    <SceneBoundary onFail={onFail}>
      <Suspense fallback={null}>
        <RevealScene players={players} />
      </Suspense>
    </SceneBoundary>
  );
}

/** Keeps a 3D failure (no WebGL context, WASM load error) from taking the HTML layer down with it. */
class SceneBoundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.warn("3D dice unavailable, showing HTML dice instead.", error);
    this.props.onFail();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}
