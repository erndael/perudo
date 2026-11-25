// Injected nondeterminism. The Room module and registry never touch Math.random,
// crypto or Date directly; they receive these instead.
import { randomInt } from "node:crypto";

/** Returns a uniformly random integer in [0, maxExclusive). */
export type Rng = (maxExclusive: number) => number;

/** Returns the current time in milliseconds. */
export type Clock = () => number;

/** Cryptographically secure RNG for production (ADR-0001). */
export const secureRng: Rng = (maxExclusive) => randomInt(maxExclusive);

export const systemClock: Clock = () => Date.now();
