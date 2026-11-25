import { describe, expect, it } from "vitest";
import { joinAs, newRoom, rolls, scriptedRng } from "./test-helpers.ts";

describe("Room capacity", () => {
  it("tells a 7th person the Room is full and does not add them", () => {
    const room = newRoom();
    const ids = ["Ana", "Ben", "Cat", "Dan", "Eve", "Fay"].map((n) => joinAs(room, n));

    const { result, views } = room.dispatch({ type: "join", nickname: "Gus" });

    expect(result).toMatchObject({ ok: false, error: { code: "room-full", message: expect.stringContaining("Room full") } });
    expect([...views.keys()]).toEqual(ids);
    expect(views.get(ids[0]!)?.people.map((p) => p.nickname)).toEqual(["Ana", "Ben", "Cat", "Dan", "Eve", "Fay"]);
  });
});

describe("people arriving mid-Game", () => {
  const twoPlayerStart = () => scriptedRng(0, ...rolls(2, 3, 4, 5, 6), ...rolls(1, 1, 2, 6, 6));

  it("are shown to everyone as waiting for the next Game, and receive no dice", () => {
    const room = newRoom({ rng: twoPlayerStart() });
    const ana = joinAs(room, "Ana");
    const ben = joinAs(room, "Ben");
    room.dispatch({ type: "start-game", by: ana });

    const { views } = room.dispatch({ type: "join", nickname: "Dan" });

    const dan = [...views.keys()][2]!;
    for (const view of views.values()) {
      expect(view.people).toEqual([
        { id: ana, nickname: "Ana", waiting: false },
        { id: ben, nickname: "Ben", waiting: false },
        { id: dan, nickname: "Dan", waiting: true },
      ]);
    }
    expect(views.get(dan)?.game?.yourDice).toBeNull();
  });

  it("nobody is waiting before the first Game", () => {
    const room = newRoom();
    joinAs(room, "Ana");
    const ben = joinAs(room, "Ben");

    expect(room.views().get(ben)?.people.map((p) => p.waiting)).toEqual([false, false]);
  });

  it("count towards the 6-person limit", () => {
    const room = newRoom({ rng: twoPlayerStart() });
    const ana = joinAs(room, "Ana");
    joinAs(room, "Ben");
    room.dispatch({ type: "start-game", by: ana });
    ["Cat", "Dan", "Eve", "Fay"].forEach((n) => joinAs(room, n));

    const { result } = room.dispatch({ type: "join", nickname: "Gus" });

    expect(result).toMatchObject({ ok: false, error: { code: "room-full" } });
  });
});

describe("nickname rules", () => {
  it.each([
    ["empty", ""],
    ["only spaces", "   "],
    ["17 characters", "Abcdefghijklmnopq"],
  ])("rejects a nickname that is %s and asks for another", (_, nickname) => {
    const room = newRoom();
    const ana = joinAs(room, "Ana");

    const { result, views } = room.dispatch({ type: "join", nickname });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid-nickname", message: expect.stringMatching(/1.16 characters/) },
    });
    expect([...views.keys()]).toEqual([ana]);
  });

  it("accepts nicknames of 1 and 16 characters, without surrounding spaces", () => {
    const room = newRoom();
    const a = joinAs(room, "  A ");
    joinAs(room, "Abcdefghijklmnop");

    expect(room.views().get(a)?.people.map((p) => p.nickname)).toEqual(["A", "Abcdefghijklmnop"]);
  });

  it.each(["Ana", "ana", " ANA "])("rejects %j when Ana is already in the Room and asks for another", (nickname) => {
    const room = newRoom();
    const ana = joinAs(room, "Ana");

    const { result, views } = room.dispatch({ type: "join", nickname });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "nickname-taken", message: expect.stringContaining("another") },
    });
    expect([...views.keys()]).toEqual([ana]);
  });
});
