import type { Face, Game, PlacedBid } from "@perudo/engine";
import type { Clock, Rng } from "../deps.ts";

export type PlayerId = string;

/** A person in the Room. Their index in `RoomState.people` is their Seat (join order). */
export interface Person {
  id: PlayerId;
  nickname: string;
}

/** Everything the Room knows. Internal: only command handlers and `view.ts` read it. */
export interface RoomState {
  code: string;
  /** In Seat order, which is join order. */
  people: Person[];
  hostId: PlayerId | null;
  nextPlayerNumber: number;
  /** The Game in progress, if any. Holds every player's dice: never copy it into a view wholesale. */
  game: Game | null;
}

/** What command handlers get besides the state and the command. */
export interface RoomContext {
  rng: Rng;
  clock: Clock;
}

export type RoomErrorCode =
  | "unknown-command"
  | "invalid-nickname"
  | "not-host"
  | "game-in-progress"
  | "not-enough-players"
  | "too-many-players"
  | "no-game"
  | "not-your-turn"
  | "illegal-bid";

export interface RoomError {
  code: RoomErrorCode;
  /** Human-readable, safe to show to the player. */
  message: string;
}

export type CommandResult =
  | { ok: true; playerId?: PlayerId }
  | { ok: false; error: RoomError };

export function reject(code: RoomErrorCode, message: string): CommandResult {
  return { ok: false, error: { code, message } };
}

/** The snapshot one player is allowed to see. Sent in full after every change. */
export interface RoomView {
  code: string;
  you: PlayerId;
  hostId: PlayerId | null;
  /** In Seat order. */
  people: { id: PlayerId; nickname: string }[];
  /** The Game in progress, or null before the first Game. */
  game: GameView | null;
}

/** What one player may see of the Game. Never contains another player's dice outside a reveal. */
export interface GameView {
  /** Round number within the Game, from 1. Changes whenever dice are re-rolled. */
  round: number;
  /** Who makes the first Bid of this Round. */
  opener: PlayerId;
  /** Sum of every player's die count. */
  totalDice: number;
  /** Everyone playing this Game, in Seat order. Die counts only: dice stay secret. */
  players: { id: PlayerId; dieCount: number }[];
  /** Whose Turn it is. */
  turn: PlayerId;
  /** Every Bid made this Round, oldest first; the last one is the current Bid. */
  bids: PlacedBid[];
  /** Whether this is a Palifico Round (changes which Bids are legal; see engine `BidRules`). */
  palifico: boolean;
  /** The viewer's own dice this Round; null if the viewer isn't playing in this Game. */
  yourDice: Face[] | null;
}
