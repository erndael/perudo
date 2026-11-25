import { depart } from "../departure.ts";
import { reject, type CommandResult, type PlayerId, type RoomContext, type RoomState } from "../types.ts";

/** A player leaves the Room for good. Same effect as being kicked (see `depart`). */
export interface LeaveCommand {
  type: "leave";
  by: PlayerId;
}

export function leave(state: RoomState, command: LeaveCommand, ctx: RoomContext): CommandResult {
  if (!state.people.some((p) => p.id === command.by)) return reject("not-in-room", "You aren't in this Room.");
  depart(state, command.by, ctx);
  return { ok: true };
}
