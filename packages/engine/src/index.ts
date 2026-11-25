// Pure Perudo rules engine (ADR-0003): no I/O, RNG passed in.
// Shared with the web app only to grey out illegal Bids; the server stays authoritative.

export type { Face, Rng } from "./dice.ts";
export { rollDice } from "./dice.ts";
export type { Game, GamePlayer, PlayerId, Round } from "./game.ts";
export { MAX_PLAYERS, MIN_PLAYERS, STARTING_DICE, startGame, totalDice } from "./game.ts";
