import { describe, expect, it } from "vitest";
import { roomCodeFromInput } from "./router.ts";

describe("roomCodeFromInput (the home page's join-by-code box)", () => {
  it("takes a typed code in any case, ignoring spaces and dashes", () => {
    expect(roomCodeFromInput("7PF9V2")).toBe("7PF9V2");
    expect(roomCodeFromInput("  7pf 9v2 ")).toBe("7PF9V2");
    expect(roomCodeFromInput("7pf-9v2")).toBe("7PF9V2");
  });

  it("takes a pasted Room link", () => {
    expect(roomCodeFromInput("https://perudo.example/r/7pf9v2")).toBe("7PF9V2");
    expect(roomCodeFromInput("localhost:5173/r/7PF9V2/")).toBe("7PF9V2");
  });

  it("refuses anything that can't be a code", () => {
    expect(roomCodeFromInput("")).toBeNull();
    expect(roomCodeFromInput("   ")).toBeNull();
    expect(roomCodeFromInput("7PF9V2!")).toBeNull();
    expect(roomCodeFromInput("https://perudo.example/")).toBeNull();
  });
});
