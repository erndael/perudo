import { describe, expect, it } from "vitest";
import { secureRng } from "./deps.ts";
import { createRegistry } from "./registry.ts";
import { fakeClock, joinAs } from "./room/test-helpers.ts";

const MINUTE = 60_000;

describe("Room codes", () => {
  it("are 6 characters from an alphabet without O, 0, I or 1", () => {
    const registry = createRegistry({ rng: secureRng, clock: fakeClock() });

    for (let i = 0; i < 500; i++) {
      expect(registry.create().code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });
});

describe("Room expiry", () => {
  it("deletes a Room 10 minutes after it becomes empty", () => {
    const clock = fakeClock();
    const registry = createRegistry({ rng: secureRng, clock });
    const code = registry.create().code;

    clock.advance(10 * MINUTE - 1);
    expect(registry.get(code)).toBeDefined();

    clock.advance(1);
    expect(registry.get(code)).toBeUndefined();
  });

  it("keeps a Room for as long as someone is in it", () => {
    const clock = fakeClock();
    const registry = createRegistry({ rng: secureRng, clock });
    const code = registry.create().code;

    clock.advance(9 * MINUTE);
    const ana = joinAs(registry.get(code)!, "Ana");
    clock.advance(24 * 60 * MINUTE);

    expect(registry.get(code)?.views().get(ana)?.people).toHaveLength(1);
  });

  it("sweeps away every expired Room, reporting their codes", () => {
    const clock = fakeClock();
    const registry = createRegistry({ rng: secureRng, clock });
    const empty = registry.create().code;
    const occupied = registry.create();
    joinAs(occupied, "Ana");
    clock.advance(5 * MINUTE);
    const newer = registry.create().code;

    expect(registry.sweep()).toEqual([]);
    clock.advance(5 * MINUTE);
    expect(registry.sweep()).toEqual([empty]);

    expect(registry.get(empty)).toBeUndefined();
    expect(registry.get(occupied.code)).toBe(occupied);
    expect(registry.get(newer)).toBeDefined();
  });
});
