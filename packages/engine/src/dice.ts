/** The value showing on a die. A Face of 1 is a Paco. */
export type Face = 1 | 2 | 3 | 4 | 5 | 6;

/** The Face that is a Paco. */
export const PACO: Face = 1;

/**
 * Returns a uniformly random integer in [0, maxExclusive).
 * Injected everywhere randomness is needed; production passes a cryptographically
 * secure one (ADR-0001), tests a scripted or seeded one.
 */
export type Rng = (maxExclusive: number) => number;

/** Rolls `count` dice: one `rng(6)` call per die, in order; value v becomes Face v + 1. */
export function rollDice(count: number, rng: Rng): Face[] {
  return Array.from({ length: count }, () => (rng(6) + 1) as Face);
}
