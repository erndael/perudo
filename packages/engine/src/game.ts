import type { PlacedBid } from "./bidding.ts";
import { rollDice, type Face, type Rng } from "./dice.ts";
import type { RoundOutcome } from "./resolution.ts";
import { nextInSeatOrder } from "./seats.ts";

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
  /**
   * Left the Room (or was kicked) during this Game: Eliminated, whatever `dice` holds. Their
   * dice are kept only while a reveal is showing them (see `leaveGame`).
   */
  departed?: true;
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
   * Set for a Palifico Round (see `BidRules.palifico`; Pacos aren't wild): the player who dropped
   * from 2 dice to 1, who always opens it (see `startNextRound`, and `leaveGame` for a cancelled
   * one). Null for a normal Round. Use `isPalifico` to ask whether this Round is one.
   */
  palificoPlayer: PlayerId | null;
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
  return { players, round: { number: 1, opener, turn: opener, bids: [], palificoPlayer: null, outcome: null } };
}

/**
 * Starts the next Round after a resolved one: applies the outcome's die change, rolls fresh
 * dice for every player in Seat order (see `rollDice`; Eliminated players roll none), and
 * gives the opening Turn to the outcome's `nextOpener`, or to the next Seat with dice if they
 * have none left (see `openerFrom`). If the die change took a player from 2 dice to 1
 * (whatever the call), the new Round is a Palifico Round and that player opens it.
 * Doesn't check that the Round has an outcome or that the Game isn't over: callers check first.
 */
export function startNextRound(game: Game, rng: Rng): Game {
  const outcome = game.round.outcome!;
  const palificoPlayer = droppedToOneDie(game);
  const opener = openerFrom(game, palificoPlayer ?? outcome.nextOpener);
  const players = game.players.map((p) => ({ id: p.id, dice: rollDice(dieCount(game, p.id), rng) }));
  return {
    ...game,
    players,
    round: {
      number: game.round.number + 1,
      opener,
      turn: opener,
      bids: [],
      palificoPlayer,
      outcome: null,
    },
  };
}

/** Whether the current Round is a Palifico Round. */
export function isPalifico(game: Game): boolean {
  return game.round.palificoPlayer !== null;
}

/**
 * Who opens when `candidate` should: `candidate` if they still have dice, otherwise the next
 * Seat after them that does (an Eliminated player never opens). Counts include a resolved
 * Round's die change (see `dieCount`). Falls back to `candidate` if nobody has dice.
 */
export function openerFrom(game: Game, candidate: PlayerId): PlayerId {
  if (dieCount(game, candidate) > 0) return candidate;
  return nextInSeatOrder(game.players, candidate, (p) => dieCount(game, p.id) > 0)?.id ?? candidate;
}

/**
 * The Game's winner: the only player with dice left, or null while two or more have dice.
 * A Game with a winner is over: no more Rounds are played. Decided from die counts, so it
 * holds as soon as the deciding Round resolves (see `dieCount`).
 */
export function winner(game: Game): PlayerId | null {
  const left = game.players.filter((p) => dieCount(game, p.id) > 0);
  return left.length === 1 ? left[0]!.id : null;
}

/** The player whose die change in this resolved Round took them from 2 dice to 1, if any. */
function droppedToOneDie(game: Game): PlayerId | null {
  const { player } = game.round.outcome!.dieChange;
  const before = game.players.find((p) => p.id === player)?.dice.length;
  return before === 2 && dieCount(game, player) === 1 ? player : null;
}

/**
 * How many dice `id` has, including the die change of a resolved Round. 0 for someone not
 * playing or who has departed (see `leaveGame`).
 */
export function dieCount(game: Game, id: PlayerId): number {
  const player = game.players.find((p) => p.id === id);
  if (!player || player.departed) return 0;
  const dice = player.dice.length;
  const change = game.round.outcome?.dieChange;
  return change?.player === id ? dice + change.delta : dice;
}

/** All dice in play across every player (after the die change, once the Round is resolved). */
export function totalDice(game: Game): number {
  return game.players.reduce((sum, p) => sum + dieCount(game, p.id), 0);
}
