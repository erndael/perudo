# The server rolls all dice and is the only one that sees them

Each player's dice are hidden information, so any design that rolls dice in the browser or sends every player's dice to every browser lets players cheat with devtools. The server rolls all dice with a cryptographically secure RNG, validates every bid, resolves Dudo and Calza, and sends each client only its own dice until a reveal.

## Considered Options

- **Client-side rolls**: trivially cheatable.
- **Peer-to-peer commit-reveal**: cheat-resistant without a trusted server, but far more complex than a friends-only game needs.
