// The Room module: pure, no I/O, RNG and clock injected (ADR-0003).
// Public seam: `createRoom(...)` then `room.dispatch(command)` -> { result, views }.
import type { Clock, Rng } from "../deps.ts";
import { handlers, type RoomCommand } from "./commands/index.ts";
import { passHostIfAway } from "./host.ts";
import { reject, type CommandResult, type PlayerId, type RoomState, type RoomView } from "./types.ts";
import { viewFor } from "./view.ts";

export type { RoomCommand } from "./commands/index.ts";
export { HOST_DISCONNECT_GRACE_MS } from "./host.ts";
export type { CommandResult, GameView, PlayerId, RoomError, RoomErrorCode, RoomView } from "./types.ts";

export interface DispatchOutcome {
  result: CommandResult;
  /** The latest full view for every connected player, keyed by player id. */
  views: Map<PlayerId, RoomView>;
}

export interface Room {
  readonly code: string;
  /** Applies one command. Untrusted input is fine: unknown or malformed commands are rejected. */
  dispatch(command: RoomCommand): DispatchOutcome;
  /** The current view for every connected player, without changing anything. */
  views(): Map<PlayerId, RoomView>;
}

export function createRoom(opts: { code: string; rng: Rng; clock: Clock; newToken: () => string }): Room {
  const state: RoomState = { code: opts.code, people: [], hostId: null, nextPlayerNumber: 1, game: null };
  const ctx = { rng: opts.rng, clock: opts.clock, newToken: opts.newToken };

  const views = () => new Map(state.people.filter((p) => p.connected).map((p) => [p.id, viewFor(state, p.id)]));
  /** Every rule driven by the clock. Idempotent: safe to run any number of times. */
  const passTime = () => passHostIfAway(state, ctx);

  return {
    code: opts.code,
    views,
    dispatch(command) {
      const handler = Object.hasOwn(handlers, command?.type)
        ? (handlers[command.type] as (s: RoomState, c: RoomCommand, x: typeof ctx) => CommandResult)
        : undefined;
      // Time-based rules run before the command (time has passed, whatever the command is)
      // and after it (the command may have made someone eligible, e.g. a reconnect).
      passTime();
      const result = handler ? handler(state, command, ctx) : reject("unknown-command", "Unknown command.");
      passTime();
      return { result, views: views() };
    },
  };
}
