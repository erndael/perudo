# Dice physics is visual only; the server decides the faces

The dice are rendered with a real physics simulation in three.js, but the physics never decides the outcome. The client receives the faces from the server (ADR-0001), simulates a throw, sees which side of each die lands up, then remaps that die's face textures so the server's face is the one showing. A natural-looking tumble was worth a physics dependency, and keeping the result out of the physics keeps the game logic simple, testable and independent of rendering.

**Update:** remapping the textures once a die had settled meant the player saw the Faces swap. The throw is now simulated headlessly before anything is displayed (rapier, fixed timestep, until every die rests), each die's Faces are assigned from its precomputed resting orientation, and the recorded throw is played back with those Faces painted on from the start. The player never sees a swap; the physics is still visual only and the server still decides the Faces.

## Considered Options

- **Scripted tumble animation** ending on the target face: no physics dependency, but less convincing.
- **Physics decides the result**: rejected because it makes randomness depend on the client's simulation and is cheatable.
