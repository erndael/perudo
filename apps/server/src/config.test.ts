import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";
import { secureRng } from "./deps.ts";

const draw = (rng: (max: number) => number) => Array.from({ length: 20 }, () => rng(6));

describe("server configuration", () => {
  it("uses the cryptographically secure RNG for every Room by default", () => {
    const config = loadConfig({});

    expect(config.port).toBe(3000);
    expect(config.rng).toBe(secureRng);
    expect(config.newRoomRng()).toBe(secureRng);
  });

  it("reads the port", () => {
    expect(loadConfig({ PORT: "4321" }).port).toBe(4321);
  });

  it("in test mode, gives every Room its own RNG seeded the same way, so rolls repeat", () => {
    const config = loadConfig({ PERUDO_TEST_MODE: "1", PERUDO_RNG_SEED: "42" });

    const first = config.newRoomRng();
    const second = config.newRoomRng();

    const a = draw(first);
    expect(a.every((n) => Number.isInteger(n) && n >= 0 && n < 6)).toBe(true);
    expect(new Set(a).size).toBeGreaterThan(1);
    expect(draw(second)).toEqual(a);
    expect(draw(loadConfig({ PERUDO_TEST_MODE: "1", PERUDO_RNG_SEED: "43" }).newRoomRng())).not.toEqual(a);
  });

  it("refuses a seed outside test mode", () => {
    expect(() => loadConfig({ PERUDO_RNG_SEED: "42" })).toThrow(/test mode/);
  });

  it("refuses a seed that isn't a whole number", () => {
    expect(() => loadConfig({ PERUDO_TEST_MODE: "1", PERUDO_RNG_SEED: "abc" })).toThrow(/PERUDO_RNG_SEED/);
  });
});
