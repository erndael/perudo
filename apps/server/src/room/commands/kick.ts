import { depart } from "../departure.ts";
import { reject, type CommandResult, type PlayerId, type RoomContext, type RoomState } from "../types.ts";

/** The Host removes another player from the Room. Same effect as that player leaving (see `depart`). */
export interface KickCommand {
  type: "kick";
  by: PlayerId;
  player: PlayerId;
}

export function kick(state: RoomState, command: KickCommand, ctx: RoomContext): CommandResult {
  if (command.by !== state.hostId) return reject("not-host", "Only the Host can kick a player.");
  if (command.player === command.by || !state.people.some((p) => p.id === command.player)) {
    return reject("invalid-player", "You can only kick another player in this Room.");
  }
  depart(state, command.player, ctx);
  return { ok: true };
}
