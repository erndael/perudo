# Pure rules engine behind a plain WebSocket server

A TypeScript pnpm monorepo: `packages/engine` holds the rules as pure functions with an injected RNG (no I/O), `apps/server` is a Node `ws` server that applies engine actions and sends each player a view filtered to what they may see, and `apps/web` is Vite + React with react-three-fiber and `@react-three/rapier`. The engine is shared with the client only to grey out illegal bids; the server stays authoritative (ADR-0001).

## Considered Options

- **Colyseus**: its default state sync broadcasts shared state to every client, which works against hiding each player's dice; for a turn-based game we gain little from it.
- **PartyKit / Cloudflare Durable Objects**: good fit for rooms, but ties hosting to one platform.

## Consequences

Rooms and games live only in server memory. A server restart ends every game in progress, which is accepted for casual private play.
