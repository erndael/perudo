import { describe, expect, it } from "vitest";
import { joinAs, newRoom } from "./test-helpers.ts";

describe("joining a Room", () => {
  it("makes the first person to join the Host", () => {
    const room = newRoom();

    const { result, views } = room.dispatch({ type: "join", nickname: "Ana" });

    expect(result).toEqual({ ok: true, playerId: expect.any(String), reconnectToken: expect.any(String) });
    const ana = (result.ok && result.playerId) || "";
    expect(views.get(ana)).toMatchObject({
      code: room.code,
      you: ana,
      hostId: ana,
      people: [{ id: ana, nickname: "Ana" }],
    });
  });

  it("gives everyone in the Room a fresh view, in join order, when someone joins", () => {
    const room = newRoom();
    const ana = joinAs(room, "Ana");
    const ben = joinAs(room, "Ben");

    const { result, views } = room.dispatch({ type: "join", nickname: "Cat" });

    const cat = (result.ok && result.playerId) || "";
    expect([...views.keys()]).toEqual([ana, ben, cat]);
    for (const [viewer, view] of views) {
      expect(view.you).toBe(viewer);
      expect(view.hostId).toBe(ana);
      expect(view.people.map((p) => p.nickname)).toEqual(["Ana", "Ben", "Cat"]);
    }
  });

  it("rejects a join whose nickname is not text (e.g. from a modified client)", () => {
    const room = newRoom();

    const { result, views } = room.dispatch({ type: "join", nickname: 42 } as never);

    expect(result).toMatchObject({ ok: false, error: { code: "invalid-nickname" } });
    expect(views.size).toBe(0);
  });

  it("gives each person a distinct id", () => {
    const room = newRoom();
    const ids = ["Ana", "Ben", "Cat"].map((n) => joinAs(room, n));
    expect(new Set(ids).size).toBe(3);
  });
});

describe("commands the Room does not understand", () => {
  it("are rejected without changing anything", () => {
    const room = newRoom();
    joinAs(room, "Ana");
    const before = room.views();

    const { result, views } = room.dispatch({ type: "toString" } as never);

    expect(result).toMatchObject({ ok: false, error: { code: "unknown-command" } });
    expect(views).toEqual(before);
  });
});
