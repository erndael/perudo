// Helpers for tests at the Room seam: commands in, per-player views out.
import { createRoom, type PlayerId, type Room } from "./index.ts";
import type { Clock, Rng } from "../deps.ts";

/** A clock that only moves when the test says so. */
export function fakeClock(start = 0): Clock & { advance(ms: number): void } {
  let now = start;
  const clock = () => now;
  clock.advance = (ms: number) => {
    now += ms;
  };
  return clock;
}

/**
 * An RNG that returns the scripted values in order, then fails loudly.
 * Each value must be in [0, maxExclusive) for the call that consumes it.
 */
export function scriptedRng(...values: number[]): Rng {
  const queue = [...values];
  return (maxExclusive) => {
    const next = queue.shift();
    if (next === undefined) throw new Error("scriptedRng: ran out of values");
    if (!Number.isInteger(next) || next < 0 || next >= maxExclusive) {
      throw new Error(`scriptedRng: ${next} is not in [0, ${maxExclusive})`);
    }
    return next;
  };
}

export function newRoom(opts: { code?: string; rng?: Rng; clock?: Clock } = {}): Room {
  return createRoom({
    code: opts.code ?? "ABCDEF",
    rng: opts.rng ?? scriptedRng(),
    clock: opts.clock ?? fakeClock(),
  });
}

/** Joins with the nickname and returns the new player's id; throws if the join is rejected. */
export function joinAs(room: Room, nickname: string): PlayerId {
  const { result } = room.dispatch({ type: "join", nickname });
  if (!result.ok) throw new Error(`join as ${nickname} rejected: ${result.error.code}`);
  if (!result.playerId) throw new Error("join result has no playerId");
  return result.playerId;
}
