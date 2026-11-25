import { describe, expect, it } from "vitest";
import type { Face } from "@perudo/engine";
import type { PlayerId, Room, RoomCommand } from "./index.ts";
import { fakeClock, joinAs, newRoom, rolls, scriptedRng } from "./test-helpers.ts";

// Ana opens (Seat 0). First Round's dice: Ana [2,3,4,5,6], Ben [1,1,2,6,6], Cat [3,3,3,4,5].
const ANA: Face[] = [2, 3, 4, 5, 6];
const BEN: Face[] = [1, 1, 2, 6, 6];
const CAT: Face[] = [3, 3, 3, 4, 5];

function mustAccept(room: Room, command: RoomCommand) {
  const { result } = room.dispatch(command);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}`);
}

/**
 * Ana (Host), Ben and Cat in a Game opened by Ana, with the first Round's dice above.
 * `laterRolls` scripts the RNG for anything after the start (e.g. the re-roll).
 */
function threePlayerGame(...laterRolls: number[]) {
  const room = newRoom({ rng: scriptedRng(0, ...rolls(...ANA), ...rolls(...BEN), ...rolls(...CAT), ...laterRolls) });
  const [ana, ben, cat] = ["Ana", "Ben", "Cat"].map((n) => joinAs(room, n)) as [PlayerId, PlayerId, PlayerId];
  mustAccept(room, { type: "start-game", by: ana });
  return { room, ana, ben, cat };
}

describe("leaving mid-Round", () => {
  it("cancels the Round with no die change: the others re-roll and the player whose Turn it was opens", () => {
    const { room, ana, ben, cat } = threePlayerGame(...rolls(6, 6, 5, 5, 4), ...rolls(1, 2, 3, 4, 5));
    mustAccept(room, { type: "bid", by: ana, count: 2, face: 3 });

    const { result, views } = room.dispatch({ type: "leave", by: cat });

    expect(result).toEqual({ ok: true });
    expect([...views.keys()]).toEqual([ana, ben]);
    for (const view of views.values()) {
      expect(view.people.map((p) => p.nickname)).toEqual(["Ana", "Ben"]);
      expect(view.game).toMatchObject({
        phase: "bidding",
        round: 2,
        opener: ben,
        turn: ben,
        bids: [],
        totalDice: 10,
        players: [
          { id: ana, dieCount: 5 },
          { id: ben, dieCount: 5 },
          { id: cat, dieCount: 0 },
        ],
        reveal: null,
        winner: null,
      });
    }
    expect(views.get(ana)?.game?.yourDice).toEqual([6, 6, 5, 5, 4]);
    expect(views.get(ben)?.game?.yourDice).toEqual([1, 2, 3, 4, 5]);
  });

  it("has the same effect when the Host kicks the player", () => {
    const rerolls = [...rolls(6, 6, 5, 5, 4), ...rolls(1, 2, 3, 4, 5)];
    const left = threePlayerGame(...rerolls);
    mustAccept(left.room, { type: "bid", by: left.ana, count: 2, face: 3 });
    const kicked = threePlayerGame(...rerolls);
    mustAccept(kicked.room, { type: "bid", by: kicked.ana, count: 2, face: 3 });

    const leaving = left.room.dispatch({ type: "leave", by: left.cat });
    const kicking = kicked.room.dispatch({ type: "kick", by: kicked.ana, player: kicked.cat });

    expect(kicking).toEqual(leaving);
  });

  it("gives the opening Turn to the next player in Seat order when the departed player had the Turn", () => {
    const { room, ana, ben, cat } = threePlayerGame(...rolls(6, 6, 5, 5, 4), ...rolls(1, 2, 3, 4, 5));
    mustAccept(room, { type: "bid", by: ana, count: 2, face: 3 });
    mustAccept(room, { type: "bid", by: ben, count: 3, face: 3 });

    const { views } = room.dispatch({ type: "kick", by: ana, player: cat });

    expect(views.get(ben)?.game).toMatchObject({ phase: "bidding", round: 2, opener: ana, turn: ana, bids: [] });
  });

  it("never shows anyone the departed player's dice", () => {
    const { room, ana, ben, cat } = threePlayerGame(...rolls(6, 6, 5, 5, 4), ...rolls(1, 2, 3, 4, 5));

    const { views } = room.dispatch({ type: "leave", by: cat });

    for (const view of views.values()) {
      expect(view.game?.reveal).toBeNull();
      expect(JSON.stringify(view)).not.toContain(JSON.stringify(CAT));
      expect(view.departed).toEqual([{ id: cat, nickname: "Cat" }]);
    }
    expect([...views.keys()]).toEqual([ana, ben]);
  });
});

describe("kicking", () => {
  it("is for the Host only", () => {
    const { room, ben, cat } = threePlayerGame();
    const before = room.views();

    const { result, views } = room.dispatch({ type: "kick", by: ben, player: cat });

    expect(result).toMatchObject({ ok: false, error: { code: "not-host" } });
    expect(views).toEqual(before);
  });

  it("rejects kicking yourself or someone who isn't in the Room", () => {
    const { room, ana } = threePlayerGame();
    const before = room.views();

    for (const player of [ana, "p99", 42]) {
      const { result, views } = room.dispatch({ type: "kick", by: ana, player } as RoomCommand);
      expect(result).toMatchObject({ ok: false, error: { code: "invalid-player" } });
      expect(views).toEqual(before);
    }
  });
});

describe("leaving mid-Round with few dice", () => {
  /**
   * Ana (Host), Ben and Cat; Seat 0 opens and every die is a 2, so an opening 1 × 6 is always
   * wrong. Ana opens with it and Ben calls Dudo, `times` times: Ana is down to 5 - `times` dice
   * and the next Round has started (a Palifico Round once she's down to 1).
   */
  function anaLoses(times: number, others = ["Ben", "Cat"]) {
    const room = newRoom({ rng: scriptedRng(0, ...Array<number>(200).fill(1)) });
    const [ana, ben, cat, dan] = ["Ana", ...others].map((n) => joinAs(room, n)) as [
      PlayerId,
      PlayerId,
      PlayerId,
      PlayerId,
    ];
    mustAccept(room, { type: "start-game", by: ana });
    for (let i = 0; i < times; i++) {
      mustAccept(room, { type: "bid", by: ana, count: 1, face: 6 });
      mustAccept(room, { type: "dudo", by: ben });
      mustAccept(room, { type: "start-next-round", by: ana });
    }
    return { room, ana, ben, cat, dan };
  }

  it("doesn't cancel the Round when an Eliminated player leaves", () => {
    const { room, ana, ben, cat } = anaLoses(5);
    mustAccept(room, { type: "bid", by: ben, count: 1, face: 2 });
    const before = room.views().get(cat)?.game;

    const { views } = room.dispatch({ type: "leave", by: ana });

    expect(views.get(cat)?.game).toEqual(before);
    expect(views.get(cat)?.hostId).toBe(ben);
  });

  it("replays a cancelled Palifico Round as a Palifico Round, opened by the player it is for", () => {
    const { room, ana, ben, cat } = anaLoses(4);
    expect(room.views().get(ana)?.game).toMatchObject({ palifico: true, opener: ana });
    mustAccept(room, { type: "bid", by: ana, count: 1, face: 2 });

    const { views } = room.dispatch({ type: "kick", by: ana, player: cat });

    expect(views.get(ben)?.game).toMatchObject({ round: 6, palifico: true, opener: ana, turn: ana, totalDice: 6 });
  });

  it("keeps replaying it as Ana's Palifico Round however many times it is cancelled", () => {
    const { room, ana, ben, cat, dan } = anaLoses(4, ["Ben", "Cat", "Dan"]);
    mustAccept(room, { type: "bid", by: ana, count: 1, face: 2 });
    mustAccept(room, { type: "leave", by: cat });
    mustAccept(room, { type: "bid", by: ana, count: 1, face: 2 });
    mustAccept(room, { type: "bid", by: ben, count: 2, face: 2 });

    const { views } = room.dispatch({ type: "leave", by: dan });

    expect(views.get(ben)?.game).toMatchObject({ round: 7, palifico: true, opener: ana, turn: ana, totalDice: 6 });
  });

  it("plays a normal Round when the player it is for leaves a replayed Palifico Round", () => {
    const { room, ana, ben, cat, dan } = anaLoses(4, ["Ben", "Cat", "Dan"]);
    mustAccept(room, { type: "bid", by: ana, count: 1, face: 2 });
    mustAccept(room, { type: "leave", by: cat });
    mustAccept(room, { type: "bid", by: ana, count: 1, face: 2 });

    const { views } = room.dispatch({ type: "leave", by: ana });

    expect(views.get(dan)?.game).toMatchObject({ round: 7, palifico: false, opener: ben, totalDice: 10 });
  });

  it("plays a normal Round instead when the player the Palifico Round was for leaves", () => {
    const { room, ana, ben } = anaLoses(4);
    mustAccept(room, { type: "bid", by: ana, count: 1, face: 2 });

    const { views } = room.dispatch({ type: "leave", by: ana });

    expect(views.get(ben)?.game).toMatchObject({ round: 6, palifico: false, opener: ben, totalDice: 10 });
  });
});

describe("leaving during a reveal", () => {
  // Threes: Ana 1 + Ben's 2 Pacos + Cat 3 = 6. Ben's 7 × 3 is wrong: Cat's Dudo costs Ben a die.
  function revealAfterBensLoss(...laterRolls: number[]) {
    const game = threePlayerGame(...laterRolls);
    mustAccept(game.room, { type: "bid", by: game.ana, count: 2, face: 3 });
    mustAccept(game.room, { type: "bid", by: game.ben, count: 7, face: 3 });
    mustAccept(game.room, { type: "dudo", by: game.cat });
    return game;
  }

  it("keeps the reveal as it was; the departed player rolls no dice next Round", () => {
    const { room, ana, ben, cat } = revealAfterBensLoss(...rolls(6, 6, 6, 6, 6), ...rolls(5, 5, 5, 5));
    const reveal = room.views().get(ana)?.game?.reveal;

    const { views } = room.dispatch({ type: "leave", by: cat });

    expect(views.get(ana)?.game).toMatchObject({
      phase: "reveal",
      reveal,
      totalDice: 9,
      players: [
        { id: ana, dieCount: 5 },
        { id: ben, dieCount: 4 },
        { id: cat, dieCount: 0 },
      ],
    });
    expect(views.get(ana)?.departed).toEqual([{ id: cat, nickname: "Cat" }]);

    const next = room.dispatch({ type: "start-next-round", by: ana }).views;
    expect(next.get(ben)?.game).toMatchObject({ phase: "bidding", round: 2, opener: ben, totalDice: 9 });
    expect(next.get(ben)?.game?.yourDice).toEqual([5, 5, 5, 5]);
  });

  it("Eliminates the player who just lost a die, and the next Seat opens in their place", () => {
    const { room, ana, ben, cat } = revealAfterBensLoss(...rolls(6, 6, 6, 6, 6), ...rolls(5, 5, 5, 5, 5));

    const { views } = room.dispatch({ type: "leave", by: ben });

    expect(views.get(ana)?.game).toMatchObject({
      phase: "reveal",
      totalDice: 10,
      players: [
        { id: ana, dieCount: 5 },
        { id: ben, dieCount: 0 },
        { id: cat, dieCount: 5 },
      ],
    });
    const next = room.dispatch({ type: "start-next-round", by: ana }).views;
    expect(next.get(cat)?.game).toMatchObject({ round: 2, opener: cat, totalDice: 10, palifico: false });
  });
});

describe("the last player with dice", () => {
  function twoPlayerGame() {
    // Ana opens; no rolls scripted after the start, so a re-roll would throw.
    const room = newRoom({ rng: scriptedRng(0, ...rolls(...ANA), ...rolls(...BEN)) });
    const [ana, ben] = ["Ana", "Ben"].map((n) => joinAs(room, n)) as [PlayerId, PlayerId];
    mustAccept(room, { type: "start-game", by: ana });
    return { room, ana, ben };
  }

  it("wins the Game when the only other player leaves mid-Round", () => {
    const { room, ana, ben } = twoPlayerGame();
    mustAccept(room, { type: "bid", by: ana, count: 2, face: 3 });

    const { views } = room.dispatch({ type: "kick", by: ana, player: ben });

    expect(views.get(ana)?.game).toMatchObject({
      phase: "over",
      winner: ana,
      reveal: null,
      totalDice: 5,
      players: [
        { id: ana, dieCount: 5 },
        { id: ben, dieCount: 0 },
      ],
    });
  });

  it("wins the Game when the only other player leaves during a reveal, which stays visible", () => {
    const { room, ana, ben } = twoPlayerGame();
    mustAccept(room, { type: "bid", by: ana, count: 2, face: 3 });
    mustAccept(room, { type: "dudo", by: ben });

    const { views } = room.dispatch({ type: "leave", by: ben });

    expect(views.get(ana)?.game).toMatchObject({ phase: "over", winner: ana, reveal: { outcome: { caller: ben } } });
    expect(views.get(ana)?.departed).toEqual([{ id: ben, nickname: "Ben" }]);
  });

  it("stays the winner if they leave after the Game is over", () => {
    const { room, ana, ben } = twoPlayerGame();
    mustAccept(room, { type: "bid", by: ana, count: 2, face: 3 });
    mustAccept(room, { type: "kick", by: ana, player: ben });
    const cat = joinAs(room, "Cat");

    const { views } = room.dispatch({ type: "leave", by: ana });

    expect(views.get(cat)?.game).toMatchObject({ phase: "over", winner: ana });
    expect(views.get(cat)?.departed).toEqual([
      { id: ben, nickname: "Ben" },
      { id: ana, nickname: "Ana" },
    ]);
    expect(views.get(cat)?.hostId).toBe(cat);
  });
});

describe("leaving outside a Game", () => {
  it("removes the person from the Room before any Game", () => {
    const room = newRoom();
    const [ana, ben, cat] = ["Ana", "Ben", "Cat"].map((n) => joinAs(room, n)) as [PlayerId, PlayerId, PlayerId];

    const { result, views } = room.dispatch({ type: "leave", by: ben });

    expect(result).toEqual({ ok: true });
    expect([...views.keys()]).toEqual([ana, cat]);
    expect(views.get(cat)).toMatchObject({ hostId: ana, game: null, departed: [] });
    expect(views.get(cat)?.people.map((p) => p.nickname)).toEqual(["Ana", "Cat"]);
  });

  it("doesn't cancel the Round when someone waiting for the next Game leaves", () => {
    const { room, ana, ben } = threePlayerGame();
    mustAccept(room, { type: "bid", by: ana, count: 2, face: 3 });
    const dan = joinAs(room, "Dan");
    const before = room.views().get(ben)?.game;

    const { views } = room.dispatch({ type: "leave", by: dan });

    expect(views.get(ben)?.game).toEqual(before);
    expect(views.get(ben)?.departed).toEqual([]);
    expect(views.get(ben)?.people.map((p) => p.nickname)).toEqual(["Ana", "Ben", "Cat"]);
  });

  it("rejects a leave from someone who isn't in the Room", () => {
    const room = newRoom();
    joinAs(room, "Ana");
    const before = room.views();

    const { result, views } = room.dispatch({ type: "leave", by: "p99" });

    expect(result).toMatchObject({ ok: false, error: { code: "not-in-room" } });
    expect(views).toEqual(before);
  });
});

describe("the departed player's Seat", () => {
  it("can't be reclaimed with their reconnect token; they can join again as a new person", () => {
    const room = newRoom();
    joinAs(room, "Ana");
    const ben = room.dispatch({ type: "join", nickname: "Ben" }).result;
    if (!ben.ok || !ben.playerId || !ben.reconnectToken) throw new Error("join failed");
    mustAccept(room, { type: "leave", by: ben.playerId });

    const { result } = room.dispatch({ type: "reconnect", token: ben.reconnectToken });

    expect(result).toMatchObject({ ok: false, error: { code: "invalid-token" } });
    const again = room.dispatch({ type: "join", nickname: "Ben" }).result;
    expect(again).toMatchObject({ ok: true });
    expect(again.ok && again.playerId).not.toBe(ben.playerId);
  });
});

describe("the departed player's nickname", () => {
  it("can't be taken by a new arrival while the Game still shows it", () => {
    const { room, cat } = threePlayerGame(...rolls(6, 6, 5, 5, 4), ...rolls(1, 2, 3, 4, 5));
    mustAccept(room, { type: "leave", by: cat });
    const before = room.views();

    const { result, views } = room.dispatch({ type: "join", nickname: " cat " });

    expect(result).toMatchObject({ ok: false, error: { code: "nickname-taken" } });
    expect(views).toEqual(before);
  });

  it("is free again once a rematch starts, and the rematch shows no departed players", () => {
    const room = newRoom({
      rng: scriptedRng(0, ...rolls(...ANA), ...rolls(...BEN), 0, ...rolls(...ANA), ...rolls(...CAT)),
    });
    const [ana, ben] = ["Ana", "Ben"].map((n) => joinAs(room, n)) as [PlayerId, PlayerId];
    mustAccept(room, { type: "start-game", by: ana });
    mustAccept(room, { type: "kick", by: ana, player: ben });
    joinAs(room, "Cat");

    const { views } = room.dispatch({ type: "start-game", by: ana });

    for (const view of views.values()) expect(view.departed).toEqual([]);
    expect(room.dispatch({ type: "join", nickname: "Ben" }).result).toMatchObject({ ok: true });
  });
});

describe("the Host leaving", () => {
  it("passes the Host role to the next player in Seat order immediately", () => {
    const room = newRoom();
    const [ana, ben, cat] = ["Ana", "Ben", "Cat"].map((n) => joinAs(room, n)) as [PlayerId, PlayerId, PlayerId];

    const { views } = room.dispatch({ type: "leave", by: ana });

    expect(views.get(cat)?.hostId).toBe(ben);
  });

  it("leaves an empty Room with no Host: its expiry clock starts, and the next arrival becomes Host", () => {
    const clock = fakeClock(1_000);
    const room = newRoom({ clock });
    const ana = joinAs(room, "Ana");
    clock.advance(5_000);

    const { views } = room.dispatch({ type: "leave", by: ana });

    expect(views.size).toBe(0);
    expect(room.emptySince()).toBe(6_000);
    const ben = joinAs(room, "Ben");
    expect(room.views().get(ben)?.hostId).toBe(ben);
  });
});
