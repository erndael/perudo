import { describe, expect, it } from "vitest";
import type { PlayerId, Room } from "./index.ts";
import { joinAs, newRoom, rolls, scriptedRng } from "./test-helpers.ts";

const NICKNAMES = ["Ana", "Ben", "Cat", "Dan", "Eve", "Fay"];

/**
 * A Room with a Game started by `players` people (5 dice each, 5 × players in play),
 * opened by the player in Seat `openerSeat`. Returns the Room and player ids in Seat order.
 */
function startedGame(players = 3, openerSeat = 0): { room: Room; ids: PlayerId[] } {
  const dice = Array.from({ length: players }, () => rolls(2, 3, 4, 5, 6)).flat();
  const room = newRoom({ rng: scriptedRng(openerSeat, ...dice) });
  const ids = NICKNAMES.slice(0, players).map((n) => joinAs(room, n));
  const { result } = room.dispatch({ type: "start-game", by: ids[0]! });
  if (!result.ok) throw new Error(`start-game rejected: ${result.error.code}`);
  return { room, ids };
}

type BidPair = [count: number, face: number];

/**
 * A Game with `players` × 5 dice in play where Seat 0 opened and `bids` were all accepted,
 * in Turn order. Returns the Room and whose Turn it is now.
 */
function afterBids(players: number, ...bids: BidPair[]): { room: Room; turn: PlayerId } {
  const { room } = startedGame(players, 0);
  for (const [count, face] of bids) {
    const by = currentTurn(room);
    const { result } = room.dispatch({ type: "bid", by, count, face } as never);
    if (!result.ok) throw new Error(`setup Bid ${count}×${face} rejected: ${result.error.code}`);
  }
  return { room, turn: currentTurn(room) };
}

function currentTurn(room: Room): PlayerId {
  const [view] = room.views().values();
  return view!.game!.turn;
}

function tryBid(players: number, history: BidPair[], [count, face]: BidPair) {
  const { room, turn } = afterBids(players, ...history);
  const before = room.views();
  const { result, views } = room.dispatch({ type: "bid", by: turn, count, face } as never);
  return { result, unchanged: JSON.stringify([...views]) === JSON.stringify([...before]) };
}

describe("the opening Bid", () => {
  // 2 players: 10 dice in play.
  it.each<BidPair>([
    [1, 2],
    [1, 6],
    [10, 2],
    [10, 6],
  ])("accepts %i × %i", (count, face) => {
    expect(tryBid(2, [], [count, face]).result).toEqual({ ok: true });
  });

  it.each<[string, BidPair]>([
    ["on Pacos", [1, 1]],
    ["on Pacos, even a big one", [5, 1]],
    ["with a count of 0", [0, 3]],
    ["with a negative count", [-1, 3]],
    ["with more dice than are in play", [11, 3]],
    ["with a fractional count", [2.5, 3]],
    ["with a count that isn't a number", ["3" as never, 3]],
    ["on Face 0", [3, 0]],
    ["on Face 7", [3, 7]],
    ["on a Face that isn't a number", [3, "4" as never]],
  ])("rejects a Bid %s, changing nothing", (_, bid) => {
    const { result, unchanged } = tryBid(2, [], bid);
    expect(result).toMatchObject({ ok: false, error: { code: "illegal-bid" } });
    expect(unchanged).toBe(true);
  });
});

/** Checks one Bid after an opening `current` Bid, in a 3-player Game (15 dice in play). */
function expectRaise(current: BidPair[], bid: BidPair, legal: boolean) {
  const { result, unchanged } = tryBid(3, current, bid);
  if (legal) {
    expect(result).toEqual({ ok: true });
  } else {
    expect(result).toMatchObject({ ok: false, error: { code: "illegal-bid" } });
    expect(unchanged).toBe(true);
  }
}

describe("Raising a Bid on a non-Paco Face", () => {
  it.each<[BidPair, boolean]>([
    [[5, 2], true],
    [[5, 3], true],
    [[9, 6], true],
    [[4, 4], true],
    [[4, 6], true],
    [[4, 3], false],
    [[4, 2], false],
    [[3, 6], false],
    [[3, 4], false],
  ])("from 4 × 3, %j is legal: %s", (bid, legal) => {
    expectRaise([[4, 3]], bid, legal);
  });

  it.each<[BidPair, BidPair, boolean]>([
    // ⌈4/2⌉ = 2
    [[4, 3], [2, 1], true],
    [[4, 3], [3, 1], true],
    [[4, 3], [1, 1], false],
    // ⌈5/2⌉ = 3
    [[5, 6], [3, 1], true],
    [[5, 6], [2, 1], false],
    // ⌈1/2⌉ = 1
    [[1, 2], [1, 1], true],
  ])("from %j, switching to Pacos with %j is legal: %s", (current, bid, legal) => {
    expectRaise([current], bid, legal);
  });

  it("can't go beyond the total dice in play", () => {
    expectRaise([[15, 5]], [15, 6], true);
    expectRaise([[15, 5]], [16, 2], false);
  });
});

describe("Raising a Bid on Pacos", () => {
  it.each<[BidPair, boolean]>([
    [[3, 1], true],
    [[7, 1], true],
    [[2, 1], false],
    [[1, 1], false],
  ])("from 2 × Pacos, %j is legal: %s", (bid, legal) => {
    expectRaise([[4, 3], [2, 1]], bid, legal);
  });

  it.each<[BidPair, BidPair, boolean]>([
    // 2 × 2 + 1 = 5
    [[2, 1], [5, 2], true],
    [[2, 1], [5, 6], true],
    [[2, 1], [4, 6], false],
    [[2, 1], [4, 2], false],
    // 2 × 3 + 1 = 7
    [[3, 1], [7, 2], true],
    [[3, 1], [6, 6], false],
  ])("from %j, switching back to another Face with %j is legal: %s", (pacos, bid, legal) => {
    expectRaise([[4, 5], pacos], bid, legal);
  });

  it("can only be Raised on Pacos when leaving Pacos would exceed the total dice in play", () => {
    // 15 dice: from 8 × Pacos, leaving needs 17.
    expectRaise([[15, 3], [8, 1]], [15, 6], false);
    expectRaise([[15, 3], [8, 1]], [9, 1], true);
    expectRaise([[15, 3], [8, 1]], [16, 1], false);
  });
});

describe("taking Turns", () => {
  it("gives the first Turn to the Opener of a normal (non-Palifico) Round", () => {
    const { room, ids } = startedGame(3, 1);

    for (const view of room.views().values()) {
      expect(view.game).toMatchObject({ turn: ids[1], bids: [], palifico: false });
    }
  });

  it("lets the Opener make the first Bid, shows it to everyone and passes the Turn to the next Seat", () => {
    const { room, ids } = startedGame(3, 0);
    const [ana, ben] = ids;

    const { result, views } = room.dispatch({ type: "bid", by: ana!, count: 3, face: 4 });

    expect(result).toEqual({ ok: true });
    for (const view of views.values()) {
      expect(view.game).toMatchObject({ turn: ben, bids: [{ by: ana, count: 3, face: 4 }] });
    }
  });

  it("passes the Turn round the table in Seat order, back to Seat 0 after the last Seat", () => {
    const { room, ids } = startedGame(3, 1);
    const [ana, ben, cat] = ids;

    room.dispatch({ type: "bid", by: ben!, count: 1, face: 2 });
    expect(room.views().get(ana!)?.game?.turn).toBe(cat);
    room.dispatch({ type: "bid", by: cat!, count: 2, face: 2 });
    expect(room.views().get(ana!)?.game?.turn).toBe(ana);
    room.dispatch({ type: "bid", by: ana!, count: 3, face: 2 });
    expect(room.views().get(ana!)?.game?.turn).toBe(ben);
    expect(room.views().get(ana!)?.game?.bids.map((b) => b.by)).toEqual([ben, cat, ana]);
  });

  it("rejects a Bid from a player whose Turn it isn't, changing nothing", () => {
    const { room, ids } = startedGame(3, 0);
    const before = room.views();

    const { result, views } = room.dispatch({ type: "bid", by: ids[1]!, count: 3, face: 4 });

    expect(result).toMatchObject({ ok: false, error: { code: "not-your-turn" } });
    expect(views).toEqual(before);
  });

  it("rejects a Bid from someone who arrived mid-Game", () => {
    const { room, ids } = startedGame(2, 0);
    const dan = joinAs(room, "Dan");
    room.dispatch({ type: "bid", by: ids[0]!, count: 3, face: 4 });
    room.dispatch({ type: "bid", by: ids[1]!, count: 4, face: 4 });
    const before = room.views();

    const { result, views } = room.dispatch({ type: "bid", by: dan, count: 5, face: 4 });

    expect(result).toMatchObject({ ok: false, error: { code: "not-your-turn" } });
    expect(views).toEqual(before);
  });

  it("rejects a Bid before any Game has started", () => {
    const room = newRoom();
    const ana = joinAs(room, "Ana");
    joinAs(room, "Ben");

    const { result } = room.dispatch({ type: "bid", by: ana, count: 1, face: 2 });

    expect(result).toMatchObject({ ok: false, error: { code: "no-game" } });
  });
});
