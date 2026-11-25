import { winner } from "@perudo/engine";
import { reject, type CommandResult, type PlayerId, type RoomState } from "../types.ts";

export interface SetCalzaCommand {
  type: "set-calza";
  by: PlayerId;
  enabled: boolean;
}

/** Host only, before a Game (or once it is over): switches Calza on or off for the Room. */
export function setCalza(state: RoomState, command: SetCalzaCommand): CommandResult {
  if (command.by !== state.hostId) return reject("not-host", "Only the Host can change the Calza option.");
  if (typeof command.enabled !== "boolean") return reject("invalid-option", "Calza is either on or off.");
  if (state.game && !winner(state.game)) {
    return reject("game-in-progress", "The Calza option can't change during a Game.");
  }
  state.calzaEnabled = command.enabled;
  return { ok: true };
}
