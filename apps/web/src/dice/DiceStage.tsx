import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, type ReactNode } from "react";

/**
 * The 3D backdrop: a canvas fixed beside the page column on wide screens, or to the bottom of the viewport on
 * narrow ones (see `.dice-stage` in styles.css), behind the HTML layer, with camera and lights.
 * Nothing in it is interactive (pointer-events: none), so HTML controls on top stay usable.
 * Put dice scenes inside; wrap physics scenes in <Physics> (see ThrowScene).
 */
export function DiceStage({ children }: { children: ReactNode }) {
  return (
    <div className="dice-stage" aria-hidden="true">
      <Canvas
        style={{ pointerEvents: "none" }}
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ position: [0, 10.5, 5.5], fov: 40 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0.4)}
      >
        <ambientLight intensity={0.9} />
        <directionalLight
          position={[3, 12, 5]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
        />
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </div>
  );
}

/** Physics settings for throws. Strong gravity makes dice settle quickly. */
export function DicePhysics({ children }: { children: ReactNode }) {
  return <Physics gravity={[0, -30, 0]}>{children}</Physics>;
}
