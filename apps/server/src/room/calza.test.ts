import { describe, expect, it } from "vitest";
import type { Face } from "@perudo/engine";
import type { Rng } from "../deps.ts";
import type { PlayerId, Room } from "./index.ts";
import { joinAs, newRoom, rolls, scriptedRng } from "./test-helpers.ts";

/** An RNG fed as the test goes (each Round's dice are only known once the previous one ends). */
function feedableRng(): Rng & { feed(...values: number[]): void } {
  const queue: number[] = [];
  const rng = (maxExclusive: number) => {
    const next = queue.shift();
    if (next === undefined) throw new Error("feedableRng: ran out of values");
    if (next < 0 || next >= maxExclusive) throw new Error(`feedableRng: ${next} is not in [0, ${maxExclusive})`);
    return next;
  };
  return Object.assign(rng, { feed: (...values: number[]) => void queue.push(...values) });
}

/** `n` dice that all show 2: no Pacos, so a Bid on 2s is exact at the total dice in play. */
function twos(n: number): number[] {
  return rolls(...Array<Face>(n).fill(2));
}

function mustAccept(room: Room, command: Parameters<Room["dispatch"]>[0]) {
  const { result } = room.dispatch(command);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}`);
}

/**
 * A Game for `names` (Seat order) opened by Seat 0, the first name being the Host.
 * Every die shows 2 in every Round, so the count of 2s is always the total dice in play.
 */
function table(...names: string[]) {
  const rng = feedableRng();
  rng.feed(0, ...twos(5 * names.length));
  const room = newRoom({ rng });
  const ids = names.map((n) => joinAs(room, n));
  const host = ids[0]!;
  mustAccept(room, { type: "start-game", by: host });

  const game = () => room.views().get(host)!.game!;

  /** Bids on 6s (there are none) round the table until `loser` has bid; the next player calls Dudo. */
  function loseADie(loser: PlayerId) {
    let count = game().bids.at(-1)?.count ?? 0;
    for (;;) {
      const by = game().turn;
      mustAccept(room, { type: "bid", by, count: ++count, face: 6 });
      if (by === loser) break;
    }
    mustAccept(room, { type: "dudo", by: game().turn });
  }

  /** The Host starts the next Round (all 2s again). */
  function nextRound() {
    rng.feed(...twos(game().totalDice));
    return room.dispatch({ type: "start-next-round", by: host });
  }

  /** `loser` loses a die and the next Round starts. */
  function roundLostBy(loser: PlayerId) {
    loseADie(loser);
    return nextRound();
  }

  /** The next Seat after `id` that still has dice: whose Turn follows `id`'s. */
  function nextWithDice(id: PlayerId): PlayerId {
    const players = game().players;
    const seat = players.findIndex((p) => p.id === id);
    for (let step = 1; step < players.length; step++) {
      const p = players[(seat + step) % players.length]!;
      if (p.dieCount > 0) return p.id;
    }
    return id;
  }

  /**
   * Bids go round the table (on 3s, of which there are none) up to `caller`'s Turn, the last
   * one being `count` x 2, then `caller` calls Calza on it. Exact when `count` is the total dice.
   */
  function calzaOn(count: number, caller: PlayerId) {
    let low = 1;
    while (nextWithDice(game().turn) !== caller) {
      mustAccept(room, { type: "bid", by: game().turn, count: low++, face: 3 });
    }
    mustAccept(room, { type: "bid", by: game().turn, count, face: 2 });
    return room.dispatch({ type: "calza", by: caller });
  }

  return { room, ids, host, game, loseADie, nextRound, roundLostBy, calzaOn };
}

describe("calling Calza", () => {
  it("gains the caller a die when the count is exact, changes no one else's dice, and lets the caller open", () => {
    const t = table("Ana", "Ben", "Cat");
    const [ana, ben, cat] = t.ids as [PlayerId, PlayerId, PlayerId];
    t.loseADie(ben);
    t.nextRound();
    expect(t.game()).toMatchObject({ opener: ben, totalDice: 14 });

    // Ben's Turn, facing Ana's Bid of 14 x 2: exactly right (every die is a 2).
    mustAccept(t.room, { type: "bid", by: ben, count: 12, face: 2 });
    mustAccept(t.room, { type: "bid", by: cat, count: 13, face: 2 });
    mustAccept(t.room, { type: "bid", by: ana, count: 14, face: 2 });
    expect(t.room.views().get(ben)?.game?.calzaAvailable).toBe(true);

    const { result, views } = t.room.dispatch({ type: "calza", by: ben });

    expect(result).toEqual({ ok: true });
    expect(views.size).toBe(3);
    for (const view of views.values()) {
      expect(view.game).toMatchObject({
        phase: "reveal",
        totalDice: 15,
        players: [
          { id: ana, dieCount: 5 },
          { id: ben, dieCount: 5 },
          { id: cat, dieCount: 5 },
        ],
        reveal: {
          outcome: {
            call: "calza",
            caller: ben,
            bid: { by: ana, count: 14, face: 2 },
            actualCount: 14,
            dieChange: { player: ben, delta: 1 },
            nextOpener: ben,
          },
        },
      });
    }

    t.nextRound();
    expect(t.game()).toMatchObject({ round: 3, opener: ben, turn: ben, totalDice: 15 });
  });

  it("never takes the caller above 5 dice", () => {
    const t = table("Ana", "Ben", "Cat");
    const [ana, ben, cat] = t.ids as [PlayerId, PlayerId, PlayerId];

    const { result, views } = t.calzaOn(15, ben);

    expect(result).toEqual({ ok: true });
    expect(views.get(cat)?.game).toMatchObject({
      phase: "reveal",
      totalDice: 15,
      players: [
        { id: ana, dieCount: 5 },
        { id: ben, dieCount: 5 },
        { id: cat, dieCount: 5 },
      ],
      reveal: { outcome: { call: "calza", actualCount: 15, dieChange: { player: ben, delta: 0 }, nextOpener: ben } },
    });
    t.nextRound();
    expect(t.game()).toMatchObject({ opener: ben, totalDice: 15 });
  });

  it("costs the caller a die when the count isn't exact, changes no one else's dice, and lets the caller open", () => {
    const t = table("Ana", "Ben", "Cat");
    const [ana, ben, cat] = t.ids as [PlayerId, PlayerId, PlayerId];

    const { result, views } = t.calzaOn(14, cat);

    expect(result).toEqual({ ok: true });
    for (const view of views.values()) {
      expect(view.game).toMatchObject({
        phase: "reveal",
        totalDice: 14,
        players: [
          { id: ana, dieCount: 5 },
          { id: ben, dieCount: 5 },
          { id: cat, dieCount: 4 },
        ],
        reveal: {
          outcome: {
            call: "calza",
            caller: cat,
            bid: { by: ben, count: 14, face: 2 },
            actualCount: 15,
            dieChange: { player: cat, delta: -1 },
            nextOpener: cat,
          },
        },
      });
    }
    t.nextRound();
    expect(t.game()).toMatchObject({ opener: cat, turn: cat, palifico: false });
  });

  it("lets the next player in Seat order open when the caller lost their last die", () => {
    const t = table("Ana", "Ben", "Cat");
    const [ana, ben, cat] = t.ids as [PlayerId, PlayerId, PlayerId];
    for (let dice = 5; dice > 1; dice--) t.roundLostBy(ben);
    t.roundLostBy(ana); // Ben's Palifico Round, lost by Ana.
    expect(t.game()).toMatchObject({ palifico: false, players: [{ dieCount: 4 }, { dieCount: 1 }, { dieCount: 5 }] });

    const { views } = t.calzaOn(5, ben);

    expect(views.get(ana)?.game).toMatchObject({
      phase: "reveal",
      players: [
        { id: ana, dieCount: 4 },
        { id: ben, dieCount: 0 },
        { id: cat, dieCount: 5 },
      ],
      reveal: { outcome: { dieChange: { player: ben, delta: -1 }, nextOpener: ben } },
    });
    t.nextRound();
    expect(t.game()).toMatchObject({ opener: cat, turn: cat, totalDice: 9 });
  });
});

describe("who may call Calza, and when", () => {
  it("rejects Calza before any Bid, out of Turn, and once the Round is over", () => {
    const t = table("Ana", "Ben", "Cat");
    const [ana, ben, cat] = t.ids as [PlayerId, PlayerId, PlayerId];
    expect(t.room.dispatch({ type: "calza", by: ana }).result).toMatchObject({ error: { code: "no-bid" } });
    mustAccept(t.room, { type: "bid", by: ana, count: 3, face: 2 });
    expect(t.room.dispatch({ type: "calza", by: cat }).result).toMatchObject({ error: { code: "not-your-turn" } });
    mustAccept(t.room, { type: "calza", by: ben });
    const before = t.room.views();

    const { result, views } = t.room.dispatch({ type: "calza", by: ben });

    expect(result).toMatchObject({ ok: false, error: { code: "round-over" } });
    expect(views).toEqual(before);
  });
});

describe("when Calza is unavailable", () => {
  it("rejects Calza in a Palifico Round, changing nothing", () => {
    const t = table("Ana", "Ben", "Cat");
    const [ana, ben] = t.ids as [PlayerId, PlayerId, PlayerId];
    for (let dice = 5; dice > 1; dice--) t.roundLostBy(ana);
    mustAccept(t.room, { type: "bid", by: ana, count: 3, face: 2 });
    const before = t.room.views();
    expect(before.get(ben)?.game?.calzaAvailable).toBe(false);

    const { result, views } = t.room.dispatch({ type: "calza", by: ben });

    expect(result).toMatchObject({ ok: false, error: { code: "calza-unavailable" } });
    expect(views).toEqual(before);
  });

  it("rejects Calza in a Game of 2 players", () => {
    const t = table("Ana", "Ben");
    const [ana, ben] = t.ids as [PlayerId, PlayerId];
    mustAccept(t.room, { type: "bid", by: ana, count: 10, face: 2 });
    const before = t.room.views();
    expect(before.get(ben)?.game?.calzaAvailable).toBe(false);

    const { result, views } = t.room.dispatch({ type: "calza", by: ben });

    expect(result).toMatchObject({ ok: false, error: { code: "calza-unavailable" } });
    expect(views).toEqual(before);
  });

  it("rejects Calza once only 2 players are left with dice", () => {
    const t = table("Ana", "Ben", "Cat");
    const [ana, ben, cat] = t.ids as [PlayerId, PlayerId, PlayerId];
    for (let dice = 5; dice > 1; dice--) t.roundLostBy(ben);
    t.roundLostBy(ben); // Ben's Palifico Round: he's Eliminated.
    expect(t.game()).toMatchObject({ phase: "bidding", players: [{ dieCount: 5 }, { dieCount: 0 }, { dieCount: 5 }] });
    mustAccept(t.room, { type: "bid", by: t.game().turn, count: 3, face: 2 });
    const caller = t.game().turn;
    expect([ana, cat]).toContain(caller);
    const before = t.room.views();
    expect(before.get(caller)?.game?.calzaAvailable).toBe(false);

    const { result, views } = t.room.dispatch({ type: "calza", by: caller });

    expect(result).toMatchObject({ ok: false, error: { code: "calza-unavailable" } });
    expect(views).toEqual(before);
  });
});

describe("the Calza option", () => {
  it("is on by default, for everyone", () => {
    const room = newRoom();
    joinAs(room, "Ana");
    joinAs(room, "Ben");

    for (const view of room.views().values()) expect(view.calzaEnabled).toBe(true);
  });

  it("lets the Host switch Calza off and on again before a Game, for everyone to see", () => {
    const room = newRoom();
    const ana = joinAs(room, "Ana");
    joinAs(room, "Ben");

    const off = room.dispatch({ type: "set-calza", by: ana, enabled: false });

    expect(off.result).toEqual({ ok: true });
    for (const view of off.views.values()) expect(view.calzaEnabled).toBe(false);
    const on = room.dispatch({ type: "set-calza", by: ana, enabled: true });
    for (const view of on.views.values()) expect(view.calzaEnabled).toBe(true);
  });

  it("is only for the Host", () => {
    const room = newRoom();
    joinAs(room, "Ana");
    const ben = joinAs(room, "Ben");
    const before = room.views();

    const { result, views } = room.dispatch({ type: "set-calza", by: ben, enabled: false });

    expect(result).toMatchObject({ ok: false, error: { code: "not-host" } });
    expect(views).toEqual(before);
  });

  it("rejects anything but on or off", () => {
    const room = newRoom();
    const ana = joinAs(room, "Ana");
    const before = room.views();

    const { result, views } = room.dispatch({ type: "set-calza", by: ana, enabled: "no" as unknown as boolean });

    expect(result).toMatchObject({ ok: false, error: { code: "invalid-option" } });
    expect(views).toEqual(before);
  });

  it("can't change during a Game, but can once it is over", () => {
    const t = table("Ana", "Ben");
    const [ana, ben] = t.ids as [PlayerId, PlayerId];
    const before = t.room.views();

    const { result, views } = t.room.dispatch({ type: "set-calza", by: ana, enabled: false });

    expect(result).toMatchObject({ ok: false, error: { code: "game-in-progress" } });
    expect(views).toEqual(before);
    for (let dice = 5; dice > 1; dice--) t.roundLostBy(ben);
    t.loseADie(ben);
    expect(t.game().phase).toBe("over");
    expect(t.room.dispatch({ type: "set-calza", by: ana, enabled: false }).result).toEqual({ ok: true });
  });

  it("when off, rejects Calza and tells players it isn't available", () => {
    const rng = scriptedRng(0, ...rolls(...Array<Face>(15).fill(2)));
    const room = newRoom({ rng });
    const [ana, ben] = ["Ana", "Ben", "Cat"].map((n) => joinAs(room, n)) as [PlayerId, PlayerId, PlayerId];
    mustAccept(room, { type: "set-calza", by: ana, enabled: false });
    mustAccept(room, { type: "start-game", by: ana });
    mustAccept(room, { type: "bid", by: ana, count: 15, face: 2 });
    const before = room.views();
    expect(before.get(ben)?.game?.calzaAvailable).toBe(false);

    const { result, views } = room.dispatch({ type: "calza", by: ben });

    expect(result).toMatchObject({ ok: false, error: { code: "calza-disabled" } });
    expect(views).toEqual(before);
  });
});

describe("Calza and Palifico", () => {
  it("makes the next Round a Palifico Round, opened by the caller, when a Calza takes them from 2 dice to 1", () => {
    const t = table("Ana", "Ben", "Cat");
    const [ana, ben, cat] = t.ids as [PlayerId, PlayerId, PlayerId];
    for (let dice = 5; dice > 2; dice--) t.roundLostBy(ben);
    expect(t.game()).toMatchObject({ palifico: false, players: [{ dieCount: 5 }, { dieCount: 2 }, { dieCount: 5 }] });
    t.calzaOn(11, ben);

    const { views } = t.nextRound();

    for (const view of views.values()) {
      expect(view.game).toMatchObject({
        palifico: true,
        opener: ben,
        turn: ben,
        players: [
          { id: ana, dieCount: 5 },
          { id: ben, dieCount: 1 },
          { id: cat, dieCount: 5 },
        ],
      });
    }
  });

  it("gives the same player a second Palifico Round after a correct Calza took them back to 2 dice", () => {
    const t = table("Ana", "Ben", "Cat");
    const [ana, ben] = t.ids as [PlayerId, PlayerId, PlayerId];
    for (let dice = 5; dice > 1; dice--) t.roundLostBy(ben);
    expect(t.game()).toMatchObject({ palifico: true, opener: ben });
    t.roundLostBy(ana); // Ana loses Ben's Palifico Round.
    expect(t.game()).toMatchObject({ palifico: false, players: [{ dieCount: 4 }, { dieCount: 1 }, { dieCount: 5 }] });

    t.calzaOn(10, ben);
    t.nextRound();
    expect(t.game()).toMatchObject({ palifico: false, opener: ben, players: [{}, { dieCount: 2 }, {}] });

    const { views } = t.roundLostBy(ben);

    for (const view of views.values()) {
      expect(view.game).toMatchObject({ palifico: true, opener: ben, turn: ben, players: [{}, { dieCount: 1 }, {}] });
    }
  });
});
