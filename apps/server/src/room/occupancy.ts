import type { RoomState } from "./types.ts";

/**
 * Whether nobody is in the Room any more. The registry deletes a Room 10 minutes after
 * this becomes true (see `Room.emptySince`). It is re-checked after every command, so a
 * command that removes or disconnects people only needs to update `state`; change this
 * one function if "in the Room" comes to mean "connected" (ticket 09).
 */
export function isEmpty(state: RoomState): boolean {
  return state.people.length === 0;
}
