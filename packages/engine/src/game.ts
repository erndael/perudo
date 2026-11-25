import type { PlacedBid } from "./bidding.ts";
import { rollDice, type Face, type Rng } from "./dice.ts";
import type { RoundOutcome } from "./resolution.ts";

export type PlayerId = string;

export const STARTING_DICE = 5;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

/** A player taking part in a Game. Their index in `Game.players` is their Seat. */
export interface GamePlayer {
  id: PlayerId;
  /**
   * This Round's dice, as rolled. Secret until a reveal (ADR-0001). `dice.length` is the die
   * count while the Round is open; once it has an outcome use `dieCount` (it includes the change).
   */
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
  /**
   * A Palifico Round (see `BidRules.palifico`; Pacos aren't wild): the Round right after a
   * player dropped from 2 dice to 1, opened by them. See `startNextRound`.
   */
  palifico: boolean;
  /** How the Round ended: null while it is open (bidding), set once resolved (the reveal). */
  outcome: RoundOutcome | null;
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
  return { players, round: { number: 1, opener, turn: opener, bids: [], palifico: false, outcome: null } };
}

/**
 * Starts the next Round after a resolved one: applies the outcome's die change, rolls fresh
 * dice for every player in Seat order (see `rollDice`; players with no dice roll none), and
 * gives the opening Turn to the outcome's `nextOpener`, or to the next Seat with dice if they
 * have none left. If the die change took a player from 2 dice to 1 (whatever the call), the
 * new Round is a Palifico Round and that player opens it.
 * Doesn't check that the Round has an outcome: callers check first.
 */
export function startNextRound(game: Game, rng: Rng): Game {
  const outcome = game.round.outcome!;
  const palifico = droppedToOneDie(game);
  const players = game.players.map((p) => ({ id: p.id, dice: rollDice(dieCount(game, p.id), rng) }));
  const seat = players.findIndex((p) => p.id === (palifico ?? outcome.nextOpener));
  const opener =
    Array.from({ length: players.length }, (_, step) => players[(seat + step) % players.length]!).find(
      (p) => p.dice.length > 0,
    )?.id ?? outcome.nextOpener;
  return {
    ...game,
    players,
    round: {
      number: game.round.number + 1,
      opener,
      turn: opener,
      bids: [],
      palifico: palifico !== null,
      outcome: null,
    },
  };
}

/** The player whose die change in this resolved Round took them from 2 dice to 1, if any. */
function droppedToOneDie(game: Game): PlayerId | null {
  const { player } = game.round.outcome!.dieChange;
  const before = game.players.find((p) => p.id === player)?.dice.length;
  return before === 2 && dieCount(game, player) === 1 ? player : null;
}

/** How many dice `id` has, including the die change of a resolved Round. 0 for someone not playing. */
export function dieCount(game: Game, id: PlayerId): number {
  const dice = game.players.find((p) => p.id === id)?.dice.length ?? 0;
  const change = game.round.outcome?.dieChange;
  return change?.player === id ? dice + change.delta : dice;
}

/** All dice in play across every player (after the die change, once the Round is resolved). */
export function totalDice(game: Game): number {
  return game.players.reduce((sum, p) => sum + dieCount(game, p.id), 0);
}
