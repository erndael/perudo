import { describe, expect, it } from "vitest";
import type { Room } from "./index.ts";
import { fakeClock, joinAs, newRoom, rolls, scriptedRng } from "./test-helpers.ts";

/** Joins and returns the new player's id and reconnect token. */
function joinWithToken(room: Room, nickname: string) {
  const { result } = room.dispatch({ type: "join", nickname });
  if (!result.ok || !result.playerId || !result.reconnectToken) throw new Error(`join as ${nickname} failed`);
  return { id: result.playerId, token: result.reconnectToken };
}

describe("reconnecting to a Room", () => {
  it("issues each person their own reconnect token on joining", () => {
    const room = newRoom();

    const ana = room.dispatch({ type: "join", nickname: "Ana" }).result;
    const ben = room.dispatch({ type: "join", nickname: "Ben" }).result;

    expect(ana).toEqual({ ok: true, playerId: expect.any(String), reconnectToken: expect.any(String) });
    expect(ben).toEqual({ ok: true, playerId: expect.any(String), reconnectToken: expect.any(String) });
    expect(ana.ok && ana.reconnectToken).not.toBe(ben.ok && ben.reconnectToken);
  });

  it("puts a player back in their Seat with their dice when they reconnect with their token", () => {
    const room = newRoom({ rng: scriptedRng(1, ...rolls(2, 3, 4, 5, 6), ...rolls(1, 1, 2, 6, 6)) });
    const ana = joinWithToken(room, "Ana");
    const ben = joinWithToken(room, "Ben");
    room.dispatch({ type: "start-game", by: ana.id });
    const before = room.views().get(ben.id);
    room.dispatch({ type: "disconnect", by: ben.id });

    const { result, views } = room.dispatch({ type: "reconnect", token: ben.token });

    expect(result).toEqual({ ok: true, playerId: ben.id, reconnectToken: ben.token });
    expect(views.get(ben.id)).toEqual(before);
    expect(views.get(ben.id)?.game?.yourDice).toEqual([1, 1, 2, 6, 6]);
    expect(views.get(ben.id)?.people.map((p) => p.nickname)).toEqual(["Ana", "Ben"]);
  });

  it("can reconnect a player whose old connection is still open (e.g. a refresh racing the close)", () => {
    const room = newRoom();
    const ana = joinWithToken(room, "Ana");

    const { result } = room.dispatch({ type: "reconnect", token: ana.token });

    expect(result).toMatchObject({ ok: true, playerId: ana.id });
    expect(room.views().get(ana.id)?.people).toEqual([{ id: ana.id, nickname: "Ana", connected: true }]);
  });

  it("rejects a token it never issued, without changing anything", () => {
    const room = newRoom();
    joinAs(room, "Ana");
    const before = room.views();

    for (const token of ["nope", 42, undefined, "toString"]) {
      const { result, views } = room.dispatch({ type: "reconnect", token } as never);
      expect(result).toMatchObject({ ok: false, error: { code: "invalid-token" } });
      expect(views).toEqual(before);
    }
  });
});

describe("disconnected players", () => {
  it("are marked as disconnected in every connected player's view, and get no view themselves", () => {
    const room = newRoom();
    const ana = joinAs(room, "Ana");
    const ben = joinAs(room, "Ben");
    const cat = joinAs(room, "Cat");

    const { views } = room.dispatch({ type: "disconnect", by: ben });

    expect([...views.keys()]).toEqual([ana, cat]);
    for (const view of views.values()) {
      expect(view.people).toEqual([
        { id: ana, nickname: "Ana", connected: true },
        { id: ben, nickname: "Ben", connected: false },
        { id: cat, nickname: "Cat", connected: true },
      ]);
    }
  });

  it("are marked as connected again once they reconnect", () => {
    const room = newRoom();
    const ana = joinAs(room, "Ana");
    const ben = joinWithToken(room, "Ben");
    room.dispatch({ type: "disconnect", by: ben.id });

    const { views } = room.dispatch({ type: "reconnect", token: ben.token });

    expect([...views.keys()]).toEqual([ana, ben.id]);
    expect(views.get(ana)?.people.map((p) => p.connected)).toEqual([true, true]);
  });

  it("keep their Seat: people who join while they're away sit after them", () => {
    const room = newRoom();
    joinAs(room, "Ana");
    const ben = joinAs(room, "Ben");
    room.dispatch({ type: "disconnect", by: ben });

    const cat = joinAs(room, "Cat");

    expect(room.views().get(cat)?.people.map((p) => p.nickname)).toEqual(["Ana", "Ben", "Cat"]);
  });

  it("hold up the Game for as long as they're away: time passing changes nothing", () => {
    const clock = fakeClock();
    const room = newRoom({ clock, rng: scriptedRng(1, ...rolls(2, 3, 4, 5, 6), ...rolls(1, 1, 2, 6, 6)) });
    const ana = joinAs(room, "Ana");
    const ben = joinWithToken(room, "Ben");
    room.dispatch({ type: "start-game", by: ana });
    const gameBefore = room.views().get(ben.id)?.game;
    room.dispatch({ type: "disconnect", by: ben.id });

    clock.advance(60 * 60 * 1000);
    room.dispatch({ type: "tick" });
    const { views } = room.dispatch({ type: "reconnect", token: ben.token });

    expect(views.get(ben.id)?.game).toEqual(gameBefore);
    expect(views.get(ana)?.game?.players).toEqual([
      { id: ana, dieCount: 5 },
      { id: ben.id, dieCount: 5 },
    ]);
  });

  it("can't be disconnected twice, nor can someone who isn't in the Room", () => {
    const room = newRoom();
    joinAs(room, "Ana");
    const ben = joinAs(room, "Ben");
    room.dispatch({ type: "disconnect", by: ben });
    const before = room.views();

    for (const by of [ben, "p99", undefined]) {
      const { result, views } = room.dispatch({ type: "disconnect", by } as never);
      expect(result).toMatchObject({ ok: false, error: { code: "not-connected" } });
      expect(views).toEqual(before);
    }
  });
});
