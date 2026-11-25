import { describe, expect, it } from "vitest";
import { joinAs, newRoom, rolls, scriptedRng } from "./test-helpers.ts";

describe("starting a Game", () => {
  it("gives every player 5 dice rolled by the server", () => {
    // Opener pick (Seat 0), then 5 dice per player in Seat order.
    const room = newRoom({ rng: scriptedRng(0, ...rolls(2, 3, 4, 5, 6), ...rolls(1, 1, 2, 6, 6)) });
    const ana = joinAs(room, "Ana");
    const ben = joinAs(room, "Ben");

    const { result, views } = room.dispatch({ type: "start-game", by: ana });

    expect(result).toEqual({ ok: true });
    expect(views.get(ana)?.game?.yourDice).toEqual([2, 3, 4, 5, 6]);
    expect(views.get(ben)?.game?.yourDice).toEqual([1, 1, 2, 6, 6]);
  });

  it("shows everyone each player's die count in Seat order, the total dice in play and the Opener", () => {
    const room = newRoom({
      rng: scriptedRng(2, ...rolls(1, 2, 3, 4, 5), ...rolls(2, 2, 2, 2, 2), ...rolls(6, 5, 4, 3, 2)),
    });
    const ana = joinAs(room, "Ana");
    const ben = joinAs(room, "Ben");
    const cat = joinAs(room, "Cat");

    const { views } = room.dispatch({ type: "start-game", by: ana });

    for (const view of views.values()) {
      expect(view.game).toMatchObject({
        round: 1,
        opener: cat,
        totalDice: 15,
        players: [
          { id: ana, dieCount: 5 },
          { id: ben, dieCount: 5 },
          { id: cat, dieCount: 5 },
        ],
      });
    }
  });

  it("picks the first Opener with the RNG, so any Seat can open", () => {
    const room = newRoom({ rng: scriptedRng(1, ...rolls(1, 1, 1, 1, 1), ...rolls(1, 1, 1, 1, 1)) });
    const ana = joinAs(room, "Ana");
    const ben = joinAs(room, "Ben");

    const { views } = room.dispatch({ type: "start-game", by: ana });

    expect(views.get(ana)?.game?.opener).toBe(ben);
  });
});

describe("who can start a Game, and when", () => {
  it("has no Game before the Host starts one", () => {
    const room = newRoom();
    const ana = joinAs(room, "Ana");
    joinAs(room, "Ben");

    expect(room.views().get(ana)?.game).toBeNull();
  });

  it("rejects a start from anyone but the Host", () => {
    const room = newRoom();
    joinAs(room, "Ana");
    const ben = joinAs(room, "Ben");
    const before = room.views();

    const { result, views } = room.dispatch({ type: "start-game", by: ben });

    expect(result).toMatchObject({ ok: false, error: { code: "not-host" } });
    expect(views).toEqual(before);
  });

  it("rejects a start with fewer than 2 players", () => {
    const room = newRoom();
    const ana = joinAs(room, "Ana");

    const { result, views } = room.dispatch({ type: "start-game", by: ana });

    expect(result).toMatchObject({ ok: false, error: { code: "not-enough-players" } });
    expect(views.get(ana)?.game).toBeNull();
  });

  it("rejects a start with more than 6 players", () => {
    const room = newRoom();
    const [ana] = ["Ana", "Ben", "Cat", "Dan", "Eve", "Fay", "Gus"].map((n) => joinAs(room, n));

    const { result, views } = room.dispatch({ type: "start-game", by: ana! });

    expect(result).toMatchObject({ ok: false, error: { code: "too-many-players" } });
    expect(views.get(ana!)?.game).toBeNull();
  });

  it("starts with 6 players", () => {
    const sixPlayers = Array.from({ length: 6 }, () => rolls(3, 3, 3, 3, 3)).flat();
    const room = newRoom({ rng: scriptedRng(5, ...sixPlayers) });
    const ids = ["Ana", "Ben", "Cat", "Dan", "Eve", "Fay"].map((n) => joinAs(room, n));

    const { result, views } = room.dispatch({ type: "start-game", by: ids[0]! });

    expect(result).toEqual({ ok: true });
    expect(views.get(ids[0]!)?.game).toMatchObject({ opener: ids[5], totalDice: 30 });
  });

  it("rejects a start while a Game is in progress, keeping everyone's dice", () => {
    const room = newRoom({ rng: scriptedRng(0, ...rolls(2, 3, 4, 5, 6), ...rolls(1, 1, 2, 6, 6)) });
    const ana = joinAs(room, "Ana");
    joinAs(room, "Ben");
    room.dispatch({ type: "start-game", by: ana });
    const before = room.views();

    const { result, views } = room.dispatch({ type: "start-game", by: ana });

    expect(result).toMatchObject({ ok: false, error: { code: "game-in-progress" } });
    expect(views).toEqual(before);
  });
});

describe("dice visibility", () => {
  it("gives someone who arrives mid-Game no dice, and doesn't seat them in the Game", () => {
    const room = newRoom({ rng: scriptedRng(0, ...rolls(2, 3, 4, 5, 6), ...rolls(1, 1, 2, 6, 6)) });
    const ana = joinAs(room, "Ana");
    const ben = joinAs(room, "Ben");
    room.dispatch({ type: "start-game", by: ana });

    const dan = joinAs(room, "Dan");

    const view = room.views().get(dan);
    expect(view?.game?.yourDice).toBeNull();
    expect(view?.game?.players.map((p) => p.id)).toEqual([ana, ben]);
    expect(JSON.stringify(view)).not.toMatch(/\[2,3,4,5,6\]|\[1,1,2,6,6\]/);
  });

  it("never puts another player's dice in a view", () => {
    const room = newRoom({
      rng: scriptedRng(0, ...rolls(2, 3, 4, 5, 6), ...rolls(1, 1, 2, 6, 6), ...rolls(5, 5, 5, 3, 3)),
    });
    const ana = joinAs(room, "Ana");
    const ben = joinAs(room, "Ben");
    const cat = joinAs(room, "Cat");

    const { views } = room.dispatch({ type: "start-game", by: ana });

    // Exact equality: nothing beyond these fields may appear in Ben's view of the Game.
    expect(views.get(ben)?.game).toEqual({
      round: 1,
      opener: ana,
      turn: ana,
      bids: [],
      palifico: false,
      totalDice: 15,
      players: [
        { id: ana, dieCount: 5 },
        { id: ben, dieCount: 5 },
        { id: cat, dieCount: 5 },
      ],
      yourDice: [1, 1, 2, 6, 6],
    });
    expect(JSON.stringify(views.get(ana))).not.toContain("[1,1,2,6,6]");
    expect(JSON.stringify(views.get(cat))).not.toContain("[1,1,2,6,6]");
  });
});
