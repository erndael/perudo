import { describe, expect, it } from "vitest";
import type { Face } from "@perudo/engine";
import type { PlayerId, Room } from "./index.ts";
import { joinAs, newRoom, rolls, scriptedRng } from "./test-helpers.ts";

// Ana opens (Seat 0). Dice: Ana [2,3,4,5,6], Ben [1,1,2,6,6], Cat [3,3,3,4,5].
// Sixes: Ana 1 + Ben 2 + Ben's 2 Pacos = 5 (Cat has none).
const ANA: Face[] = [2, 3, 4, 5, 6];
const BEN: Face[] = [1, 1, 2, 6, 6];
const CAT: Face[] = [3, 3, 3, 4, 5];

/**
 * A 3-player Game opened by Ana, with Ana's then Ben's Bid made, so it's Cat's Turn.
 * `laterRolls` scripts the RNG for anything after the start (e.g. the next Round's dice).
 */
function catsTurnAfter(anaBid: [number, Face], benBid: [number, Face], ...laterRolls: number[]) {
  const room = newRoom({ rng: scriptedRng(0, ...rolls(...ANA), ...rolls(...BEN), ...rolls(...CAT), ...laterRolls) });
  const [ana, ben, cat] = ["Ana", "Ben", "Cat"].map((n) => joinAs(room, n)) as [PlayerId, PlayerId, PlayerId];
  mustAccept(room, { type: "start-game", by: ana });
  mustAccept(room, { type: "bid", by: ana, count: anaBid[0], face: anaBid[1] });
  mustAccept(room, { type: "bid", by: ben, count: benBid[0], face: benBid[1] });
  return { room, ana, ben, cat };
}

function mustAccept(room: Room, command: Parameters<Room["dispatch"]>[0]) {
  const { result } = room.dispatch(command);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}`);
}

/** Dice as the reveal shows them: each Face, and whether it counts toward the Bid. */
function revealed(faces: Face[], counting: Face[]) {
  return faces.map((face) => ({ face, counts: counting.includes(face) }));
}

describe("calling Dudo", () => {
  it("costs the bidder a die when the actual count is below the Bid, and reveals every die to everyone", () => {
    const { room, ana, ben, cat } = catsTurnAfter([3, 6], [6, 6]);

    const { result, views } = room.dispatch({ type: "dudo", by: cat });

    expect(result).toEqual({ ok: true });
    for (const view of views.values()) {
      expect(view.game).toMatchObject({
        phase: "reveal",
        totalDice: 14,
        players: [
          { id: ana, dieCount: 5 },
          { id: ben, dieCount: 4 },
          { id: cat, dieCount: 5 },
        ],
        reveal: {
          players: [
            { id: ana, dice: revealed(ANA, [6, 1]) },
            { id: ben, dice: revealed(BEN, [6, 1]) },
            { id: cat, dice: revealed(CAT, [6, 1]) },
          ],
          outcome: {
            call: "dudo",
            caller: cat,
            bid: { by: ben, count: 6, face: 6 },
            actualCount: 5,
            dieChange: { player: ben, delta: -1 },
            nextOpener: ben,
          },
        },
      });
    }
  });

  it.each<[string, [number, Face], number]>([
    ["exactly matches the Bid", [5, 6], 5],
    ["is above the Bid", [4, 6], 5],
  ])("costs the caller a die when the actual count %s", (_, benBid, count) => {
    const { room, ben, cat } = catsTurnAfter([3, 6], benBid);

    const { views } = room.dispatch({ type: "dudo", by: cat });

    expect(views.get(ben)?.game).toMatchObject({
      players: [{ dieCount: 5 }, { dieCount: 5 }, { dieCount: 4 }],
      reveal: { outcome: { actualCount: count, dieChange: { player: cat, delta: -1 }, nextOpener: cat } },
    });
  });

  it("counts only Pacos toward a Bid on Pacos", () => {
    // Ben's 2 Pacos are the only ones.
    const { room, ben, cat } = catsTurnAfter([3, 6], [2, 1]);

    const { views } = room.dispatch({ type: "dudo", by: cat });

    expect(views.get(cat)?.game?.reveal).toMatchObject({
      players: [{ dice: revealed(ANA, [1]) }, { dice: revealed(BEN, [1]) }, { dice: revealed(CAT, [1]) }],
      outcome: { actualCount: 2, dieChange: { player: cat, delta: -1 } },
    });
    expect(views.get(cat)?.game?.reveal?.outcome.bid).toEqual({ by: ben, count: 2, face: 1 });
  });

  it("is rejected before anyone has made a Bid this Round", () => {
    const room = newRoom({ rng: scriptedRng(0, ...rolls(...ANA), ...rolls(...BEN)) });
    const ana = joinAs(room, "Ana");
    joinAs(room, "Ben");
    mustAccept(room, { type: "start-game", by: ana });
    const before = room.views();

    const { result, views } = room.dispatch({ type: "dudo", by: ana });

    expect(result).toMatchObject({ ok: false, error: { code: "no-bid" } });
    expect(views).toEqual(before);
  });

  it("is rejected from a player whose Turn it isn't", () => {
    const { room, ana } = catsTurnAfter([3, 6], [4, 6]);
    const before = room.views();

    const { result, views } = room.dispatch({ type: "dudo", by: ana });

    expect(result).toMatchObject({ ok: false, error: { code: "not-your-turn" } });
    expect(views).toEqual(before);
  });

  it("is rejected before any Game has started", () => {
    const room = newRoom();
    const ana = joinAs(room, "Ana");

    expect(room.dispatch({ type: "dudo", by: ana }).result).toMatchObject({ ok: false, error: { code: "no-game" } });
  });
});

describe("the reveal", () => {
  it("accepts no more Bids or Dudos until the next Round", () => {
    const { room, ana, ben, cat } = catsTurnAfter([3, 6], [6, 6]);
    room.dispatch({ type: "dudo", by: cat });
    const before = room.views();

    for (const by of [ana, ben, cat]) {
      const bid = room.dispatch({ type: "bid", by, count: 9, face: 6 });
      expect(bid.result).toMatchObject({ ok: false, error: { code: "round-over" } });
      const dudo = room.dispatch({ type: "dudo", by });
      expect(dudo.result).toMatchObject({ ok: false, error: { code: "round-over" } });
    }
    expect(room.views()).toEqual(before);
  });

  it("is shown to someone who arrived mid-Game too", () => {
    const { room, cat } = catsTurnAfter([3, 6], [6, 6]);
    const dan = joinAs(room, "Dan");

    const { views } = room.dispatch({ type: "dudo", by: cat });

    expect(views.get(dan)?.game?.reveal?.players.map((p) => p.dice.map((d) => d.face))).toEqual([ANA, BEN, CAT]);
  });
});

describe("starting the next Round", () => {
  // Round 2 dice, rolled in Seat order; Ben lost a die in Round 1.
  const ANA_2: Face[] = [6, 6, 5, 4, 1];
  const BEN_2: Face[] = [2, 2, 3, 3];
  const CAT_2: Face[] = [4, 5, 6, 1, 2];
  const ROUND_2 = [...rolls(...ANA_2), ...rolls(...BEN_2), ...rolls(...CAT_2)];

  it("rolls fresh dice for everyone, keeps each player's own dice secret again, and lets the loser open", () => {
    const { room, ana, ben, cat } = catsTurnAfter([3, 6], [6, 6], ...ROUND_2);
    room.dispatch({ type: "dudo", by: cat });

    const { result, views } = room.dispatch({ type: "start-next-round", by: ana });

    expect(result).toEqual({ ok: true });
    const own = { [ana]: ANA_2, [ben]: BEN_2, [cat]: CAT_2 };
    for (const [viewer, view] of views) {
      expect(view.game).toEqual({
        phase: "bidding",
        round: 2,
        opener: ben,
        turn: ben,
        bids: [],
        palifico: false,
        calzaBlockedBy: null,
        totalDice: 14,
        players: [
          { id: ana, dieCount: 5 },
          { id: ben, dieCount: 4 },
          { id: cat, dieCount: 5 },
        ],
        yourDice: own[viewer],
        reveal: null,
        winner: null,
      });
    }
  });

  it("lets the caller open when the caller lost the die", () => {
    const CAT_LOST = [...rolls(...ANA_2), ...rolls(1, 2, 3, 4, 5), ...rolls(6, 6, 6, 6)];
    const { room, ana, cat } = catsTurnAfter([3, 6], [5, 6], ...CAT_LOST);
    room.dispatch({ type: "dudo", by: cat });

    const { views } = room.dispatch({ type: "start-next-round", by: ana });

    expect(views.get(cat)?.game).toMatchObject({ opener: cat, turn: cat, yourDice: [6, 6, 6, 6] });
  });

  it("is only for the Host", () => {
    const { room, ben, cat } = catsTurnAfter([3, 6], [6, 6], ...ROUND_2);
    room.dispatch({ type: "dudo", by: cat });
    const before = room.views();

    for (const by of [ben, cat]) {
      const { result } = room.dispatch({ type: "start-next-round", by });
      expect(result).toMatchObject({ ok: false, error: { code: "not-host" } });
    }
    expect(room.views()).toEqual(before);
  });

  it("is rejected while the Round is still being played", () => {
    const { room, ana } = catsTurnAfter([3, 6], [6, 6]);
    const before = room.views();

    const { result, views } = room.dispatch({ type: "start-next-round", by: ana });

    expect(result).toMatchObject({ ok: false, error: { code: "round-in-progress" } });
    expect(views).toEqual(before);
  });

  it("is rejected before any Game has started", () => {
    const room = newRoom();
    const ana = joinAs(room, "Ana");

    const { result } = room.dispatch({ type: "start-next-round", by: ana });

    expect(result).toMatchObject({ ok: false, error: { code: "no-game" } });
  });

  it("can be played to another Dudo", () => {
    const { room, ana, ben, cat } = catsTurnAfter([3, 6], [6, 6], ...ROUND_2);
    room.dispatch({ type: "dudo", by: cat });
    room.dispatch({ type: "start-next-round", by: ana });

    // Round 2: 2s are Ben 2 + Cat 1 + Pacos (Ana 1, Cat 1) = 5.
    mustAccept(room, { type: "bid", by: ben, count: 6, face: 2 });
    const { views } = room.dispatch({ type: "dudo", by: cat });

    expect(views.get(ana)?.game).toMatchObject({
      phase: "reveal",
      round: 2,
      players: [{ dieCount: 5 }, { dieCount: 3 }, { dieCount: 5 }],
      reveal: { outcome: { caller: cat, actualCount: 5, dieChange: { player: ben, delta: -1 } } },
    });
  });
});
