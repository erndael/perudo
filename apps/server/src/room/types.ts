import type { Face, Game, PlacedBid, PlayerId, RoundOutcome } from "@perudo/engine";
import type { Clock, Rng } from "../deps.ts";

export type { PlayerId } from "@perudo/engine";

/** A person in the Room. Their index in `RoomState.people` is their Seat (join order). */
export interface Person {
  id: PlayerId;
  nickname: string;
  /** Secret issued on join; presenting it again reclaims this Seat (see `reconnect`). */
  reconnectToken: string;
  connected: boolean;
  /** When they last disconnected (clock ms); null while connected. */
  disconnectedAt: number | null;
}

/** Everything the Room knows. Internal: only command handlers and `view.ts` read it. */
export interface RoomState {
  code: string;
  /** In Seat order, which is join order. */
  people: Person[];
  hostId: PlayerId | null;
  /**
   * Secret handed to whoever created the Room (see `Room.hostKey`). Joining with it makes that
   * person Host, even if others joined first. Single use: null once presented.
   */
  hostKey: string | null;
  nextPlayerNumber: number;
  /** The Game in progress, if any. Holds every player's dice: never copy it into a view wholesale. */
  game: Game | null;
  /**
   * People who left or were kicked during the current Game, so its Seats and reveal can still name
   * them (their nicknames stay taken). Emptied when the next Game starts.
   */
  departed: { id: PlayerId; nickname: string }[];
}

/** What command handlers get besides the state and the command. */
export interface RoomContext {
  rng: Rng;
  clock: Clock;
  /** A fresh, unguessable reconnect token. */
  newToken: () => string;
}

export type RoomErrorCode =
  | "unknown-command"
  | "invalid-nickname"
  | "not-host"
  | "game-in-progress"
  | "not-enough-players"
  | "too-many-players"
  | "room-full"
  | "nickname-taken"
  | "no-game"
  | "not-your-turn"
  | "illegal-bid"
  | "invalid-token"
  | "not-connected"
  | "round-over"
  | "no-bid"
  | "round-in-progress"
  | "game-over"
  | "calza-unavailable"
  | "not-in-room"
  | "invalid-player";

export interface RoomError {
  code: RoomErrorCode;
  /** Human-readable, safe to show to the player. */
  message: string;
}

export type CommandResult =
  | { ok: true; playerId?: PlayerId; reconnectToken?: string }
  | { ok: false; error: RoomError };

export type Rejection = Extract<CommandResult, { ok: false }>;

export function reject(code: RoomErrorCode, message: string): Rejection {
  return { ok: false, error: { code, message } };
}

/** The snapshot one player is allowed to see. Sent in full after every change. */
export interface RoomView {
  code: string;
  you: PlayerId;
  hostId: PlayerId | null;
  /** In Seat order. Disconnected people keep their Seat. */
  people: {
    id: PlayerId;
    nickname: string;
    /** Arrived while a Game was in progress: not playing it, joins the next Game. */
    waiting: boolean;
    connected: boolean;
  }[];
  /** The Game in progress, or null before the first Game. */
  game: GameView | null;
  /** Nicknames of people who left the Room (or were kicked) but still appear in the Game. */
  departed: { id: PlayerId; nickname: string }[];
}

/**
 * Where the Game is: "bidding" while the Round is open, "reveal" once it has resolved
 * (until the Host starts the next Round), "over" once one player has dice left (until the
 * Host starts a rematch). The final reveal stays visible while the Game is over.
 */
export type GamePhase = "bidding" | "reveal" | "over";

/** What everyone sees once a Round resolves: every player's dice, and the outcome. */
export interface RevealView {
  /** Everyone playing, in Seat order, with this Round's dice as rolled. */
  players: {
    id: PlayerId;
    /** `counts` is decided by the server: whether the die counts toward the called Bid (Pacos wild outside Palifico). */
    dice: { face: Face; counts: boolean }[];
  }[];
  outcome: RoundOutcome;
}

/** What one player may see of the Game. Never contains another player's dice outside a reveal. */
export interface GameView {
  phase: GamePhase;
  /** Round number within the Game, from 1. Changes whenever dice are re-rolled. */
  round: number;
  /** Who makes the first Bid of this Round. */
  opener: PlayerId;
  /** Sum of every player's die count. */
  totalDice: number;
  /** Everyone playing this Game, in Seat order. Die counts only: dice stay secret. 0 = Eliminated. */
  players: { id: PlayerId; dieCount: number }[];
  /** Whose Turn it is. */
  turn: PlayerId;
  /** Every Bid made this Round, oldest first; the last one is the current Bid. */
  bids: PlacedBid[];
  /** Whether this is a Palifico Round (changes which Bids are legal; see engine `BidRules`). */
  palifico: boolean;
  /** Whether Calza may be called this Round: not a Palifico Round, more than 2 players left. */
  calzaAvailable: boolean;
  /** The viewer's own dice this Round, as rolled; null if the viewer isn't playing in this Game. */
  yourDice: Face[] | null;
  /** Every player's dice and the Round outcome: once the Round has resolved ("reveal", and "over" after a final Dudo). */
  reveal: RevealView | null;
  /** The only player with dice left once the Game is over; null until then. */
  winner: PlayerId | null;
}
