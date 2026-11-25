import type { PlacedBid } from "./bidding.ts";
import { rollDice, type Face, type Rng } from "./dice.ts";

export type PlayerId = string;

export const STARTING_DICE = 5;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

/** A player taking part in a Game. Their index in `Game.players` is their Seat. */
export interface GamePlayer {
  id: PlayerId;
  /** This Round's dice; `dice.length` is the player's die count. Secret until a reveal (ADR-0001). */
  dice: Face[];
}

export interface Round {
  /** 1 for the Game's first Round, then +1 for every new roll of the dice. */
  number: number;
  opener: PlayerId;
  /** Whose Turn it is: the Opener's at the start of a Round, then the next Seat with dice after each Bid. */
  turn: PlayerId;
  /** Every Bid made this Round, oldest first. The last one is the current Bid. */
  bids: PlacedBid[];
  /** A Palifico Round (see `BidRules.palifico`). Never set yet: ticket 06 triggers it. */
  palifico: boolean;
}

/** One Game, from start until a single player has dice left. */
export interface Game {
  /** In Seat order. Fixed for the whole Game; people arriving later wait for the next Game. */
  players: GamePlayer[];
  round: Round;
}

/**
 * Starts a Game for `playerIds` (in Seat order). Everyone gets 5 dice.
 * RNG use, in order: one `rng(playerIds.length)` call picks the first Opener's Seat
 * at random, then each player's dice are rolled in Seat order (see `rollDice`).
 */
export function startGame(playerIds: readonly PlayerId[], rng: Rng): Game {
  const opener = playerIds[rng(playerIds.length)]!;
  const players = playerIds.map((id) => ({ id, dice: rollDice(STARTING_DICE, rng) }));
  return { players, round: { number: 1, opener, turn: opener, bids: [], palifico: false } };
}

/** All dice in play across every player. */
export function totalDice(game: Game): number {
  return game.players.reduce((sum, p) => sum + p.dice.length, 0);
}
