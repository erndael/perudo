import { reject, type CommandResult, type RoomState } from "../types.ts";

/** Sent by the transport when a connection presents a reconnect token instead of joining. */
export interface ReconnectCommand {
  type: "reconnect";
  token: string;
}

/** Puts the token's owner back in their Seat, connected. Also fine if they never noticed they'd dropped. */
export function reconnect(state: RoomState, command: ReconnectCommand): CommandResult {
  const person =
    typeof command.token === "string" ? state.people.find((p) => p.reconnectToken === command.token) : undefined;
  if (!person) return reject("invalid-token", "That Seat is no longer yours. Please join again.");

  person.connected = true;
  person.disconnectedAt = null;
  return { ok: true, playerId: person.id, reconnectToken: person.reconnectToken };
}
