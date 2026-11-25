import type { RoomState } from "./types.ts";

/**
 * Whether nobody is in the Room any more: nobody has joined, or everyone has disconnected
 * (their Seats are kept until then). The registry deletes a Room 10 minutes after this
 * becomes true (see `Room.emptySince`). It is re-checked after every command, so a
 * command that removes or disconnects people only needs to update `state`.
 */
export function isEmpty(state: RoomState): boolean {
  return !state.people.some((p) => p.connected);
}
