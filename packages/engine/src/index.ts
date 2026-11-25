// Pure Perudo rules engine (ADR-0003): no I/O, RNG passed in.
// Shared with the web app only to grey out illegal Bids; the server stays authoritative.

export type { Bid, BidRules, PlacedBid } from "./bidding.ts";
export { bidRules, bidRulesFor, isLegalBid, placeBid } from "./bidding.ts";
export type { Face, Rng } from "./dice.ts";
export { PACO, rollDice } from "./dice.ts";
export { leaveGame } from "./departure.ts";
export type { Game, GamePlayer, PlayerId, Round } from "./game.ts";
export {
  dieCount,
  isPalifico,
  MAX_DICE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  openerFrom,
  STARTING_DICE,
  startGame,
  startNextRound,
  totalDice,
  winner,
} from "./game.ts";
export type { RoundOutcome } from "./resolution.ts";
export { actualCount, callCalza, callDudo, calzaAllowed, countsToward } from "./resolution.ts";
export { nextInSeatOrder } from "./seats.ts";
