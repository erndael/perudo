import { describe, expect, it } from "vitest";
import { createRegistry } from "./registry.ts";
import { fakeClock, joinAs } from "./room/test-helpers.ts";
import { secureRng } from "./deps.ts";

describe("Room registry", () => {
  it("creates a Room that can then be found by its code and joined", () => {
    const registry = createRegistry({ rng: secureRng, clock: fakeClock() });

    const code = registry.create().code;
    const room = registry.get(code);

    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(room).toBeDefined();
    const ana = joinAs(room!, "Ana");
    expect(registry.get(code)!.views().get(ana)?.hostId).toBe(ana);
  });

  it("does not find a code it never created", () => {
    const registry = createRegistry({ rng: secureRng, clock: fakeClock() });
    registry.create();
    expect(registry.get("NOPE00")).toBeUndefined();
  });

  it("gives every Room its own code", () => {
    const registry = createRegistry({ rng: secureRng, clock: fakeClock() });
    const codes = Array.from({ length: 50 }, () => registry.create().code);
    expect(new Set(codes).size).toBe(50);
  });
});
