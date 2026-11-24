# Dice physics is visual only; the server decides the faces

The dice are rendered with a real physics simulation in three.js, but the physics never decides the outcome. The client receives the faces from the server (ADR-0001), simulates a throw, sees which side of each die lands up, then remaps that die's face textures so the server's face is the one showing. A natural-looking tumble was worth a physics dependency, and keeping the result out of the physics keeps the game logic simple, testable and independent of rendering.

## Considered Options

- **Scripted tumble animation** ending on the target face: no physics dependency, but less convincing.
- **Physics decides the result**: rejected because it makes randomness depend on the client's simulation and is cheatable.
