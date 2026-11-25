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
}

/** What command handlers get besides the state and the command. */
export interface RoomContext {
  rng: Rng;
  clock: Clock;
}

export type RoomErrorCode = "unknown-command" | "invalid-nickname";

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
}
