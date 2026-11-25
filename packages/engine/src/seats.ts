import type { PlayerId } from "./game.ts";

/**
 * The first of `seats` after `from` in Seat order (array order), wrapping round the table and
 * never `from` itself, that `matches`; undefined if nobody does. `from` must be in `seats`.
 * Shared by the Game (Turns, Openers) and the Room (Host handover).
 */
export function nextInSeatOrder<T extends { id: PlayerId }>(
  seats: readonly T[],
  from: PlayerId,
  matches: (seat: T) => boolean = () => true,
): T | undefined {
  const start = seats.findIndex((s) => s.id === from);
  for (let step = 1; step < seats.length; step++) {
    const seat = seats[(start + step) % seats.length]!;
    if (matches(seat)) return seat;
  }
  return undefined;
}
