// Who is Host, and how the role moves on. Handover always goes to the next eligible
// person in Seat order after the current Host, wrapping round the table.
import type { Person, PlayerId, RoomContext, RoomState } from "./types.ts";

/** How long the Host may be disconnected before the role passes on. */
export const HOST_DISCONNECT_GRACE_MS = 30_000;

/**
 * The first person after `from` in Seat order (wrapping, never `from` itself) who is `eligible`.
 * `from` must still be in `state.people` so their Seat is known (ticket 10: call before removing a leaver).
 */
export function nextInSeatOrder(
  state: RoomState,
  from: PlayerId,
  eligible: (person: Person) => boolean = () => true,
): Person | undefined {
  const start = state.people.findIndex((p) => p.id === from);
  for (let step = 1; step < state.people.length; step++) {
    const person = state.people[(start + step) % state.people.length]!;
    if (eligible(person)) return person;
  }
  return undefined;
}

/**
 * Hands the Host role to the next connected person once the Host has been disconnected
 * for the grace period. If nobody is connected, the role stays put until someone is.
 * A Host who later returns is a normal player: nothing hands the role back.
 */
export function passHostIfAway(state: RoomState, ctx: RoomContext): void {
  const host = state.people.find((p) => p.id === state.hostId);
  if (!host || host.connected || host.disconnectedAt === null) return;
  if (ctx.clock() - host.disconnectedAt < HOST_DISCONNECT_GRACE_MS) return;

  const next = nextInSeatOrder(state, host.id, (p) => p.connected);
  if (next) state.hostId = next.id;
}
