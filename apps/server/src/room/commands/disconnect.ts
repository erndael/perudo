import { reject, type CommandResult, type PlayerId, type RoomContext, type RoomState } from "../types.ts";

/** Sent by the transport (never by a client) when a player's connection closes. They keep their Seat. */
export interface DisconnectCommand {
  type: "disconnect";
  by: PlayerId;
}

export function disconnect(state: RoomState, command: DisconnectCommand, ctx: RoomContext): CommandResult {
  const person = state.people.find((p) => p.id === command.by);
  if (!person?.connected) return reject("not-connected", "You aren't connected to this Room.");

  person.connected = false;
  person.disconnectedAt = ctx.clock();
  return { ok: true };
}
