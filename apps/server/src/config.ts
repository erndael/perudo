// Server configuration from the environment.
//   PORT              HTTP/WebSocket port (default 3000)
//   PERUDO_TEST_MODE  "1" enables test-only settings below. Never set it in production.
//   PERUDO_RNG_SEED   test mode only: an integer seed. Every Room then gets its own RNG
//                     seeded with it, so the same commands roll the same dice in every
//                     Room, however many Rooms other tests create in parallel.
import { secureRng, type Rng } from "./deps.ts";

export interface Config {
  port: number;
  /** For Room codes. */
  rng: Rng;
  /** Called once per new Room; the Room rolls all its dice with the returned RNG. */
  newRoomRng: () => Rng;
  /** Test-only settings are in effect (seeded, insecure dice). Never true in production. */
  testMode: boolean;
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const port = Number(env.PORT ?? 3000);
  const seed = env.PERUDO_RNG_SEED;
  if (seed === undefined) return { port, rng: secureRng, newRoomRng: () => secureRng, testMode: false };

  if (env.PERUDO_TEST_MODE !== "1") {
    throw new Error("PERUDO_RNG_SEED is only accepted in test mode (PERUDO_TEST_MODE=1).");
  }
  if (!/^-?\d+$/.test(seed)) throw new Error(`PERUDO_RNG_SEED must be an integer, got "${seed}".`);
  return { port, rng: secureRng, newRoomRng: () => seededRng(Number(seed)), testMode: true };
}

/** Deterministic, NOT secure (mulberry32). Test mode only. */
function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return (maxExclusive) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(unit * maxExclusive);
  };
}
