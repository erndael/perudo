import { describe, expect, it } from "vitest";
import type { Face } from "@perudo/engine";
import type { Rng } from "../deps.ts";
import type { PlayerId, Room } from "./index.ts";
import { joinAs, newRoom, rolls } from "./test-helpers.ts";

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

/** `n` dice that all show 2: no Pacos, no 6s, so every Bid on 6 is wrong. */
function twos(n: number): number[] {
  return rolls(...Array<Face>(n).fill(2));
}

function mustAccept(room: Room, command: Parameters<Room["dispatch"]>[0]) {
  const { result } = room.dispatch(command);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}`);
}

/**
 * A Game for `names` (Seat order) opened by Seat 0, the first name being the Host. Unless a
 * test feeds other dice, every die shows 2.
 */
function table(...names: string[]) {
  const rng = feedableRng();
  rng.feed(0, ...twos(5 * names.length));
  const room = newRoom({ rng });
  const ids = names.map((n) => joinAs(room, n));
  const host = ids[0]!;
  mustAccept(room, { type: "start-game", by: host });

  const game = () => room.views().get(host)!.game!;

  /**
   * Plays the open Round so that `loser` loses a die: Bids on 6 go round the table (each one
   * more than the last) until `loser` has made one, then the next player calls Dudo on it.
   * Only right while nobody has a 6 or a Paco (see `twos`).
   */
  function loseADie(loser: PlayerId) {
    let count = game().bids.at(-1)?.count ?? 0;
    for (;;) {
      const by = game().turn;
      mustAccept(room, { type: "bid", by, count: ++count, face: 6 });
      if (by === loser) break;
    }
    mustAccept(room, { type: "dudo", by: game().turn });
  }

  /** The Host starts the next Round, rolling `dice` (in Seat order), or all 2s. */
  function nextRound(dice?: Face[]) {
    rng.feed(...(dice ? rolls(...dice) : twos(game().totalDice)));
    return room.dispatch({ type: "start-next-round", by: host });
  }

  /** `loser` loses a die and the next Round starts (with all 2s). */
  function roundLostBy(loser: PlayerId) {
    loseADie(loser);
    return nextRound();
  }

  return { room, ids, host, game, loseADie, nextRound, roundLostBy };
}

/**
 * Ana, Ben and Cat (Ana opens Round 1); Ana loses four Rounds, so Round 5 is her Palifico Round,
 * with `dice` rolled for it (Ana's 1 die, then Ben's 5, then Cat's 5), or all 2s.
 */
function anasPalificoRound(dice?: Face[]) {
  const t = table("Ana", "Ben", "Cat");
  const [ana, ben, cat] = t.ids as [PlayerId, PlayerId, PlayerId];
  for (let round = 1; round <= 3; round++) t.roundLostBy(ana);
  t.loseADie(ana);
  t.nextRound(dice);
  return { ...t, ana, ben, cat };
}

describe("Palifico", () => {
  it("makes the next Round a Palifico Round, opened by the player who dropped from 2 dice to 1, for everyone", () => {
    const t = table("Ana", "Ben", "Cat");
    const [ana, ben, cat] = t.ids as [PlayerId, PlayerId, PlayerId];
    for (let dice = 5; dice > 2; dice--) {
      t.roundLostBy(ana);
      expect(t.game()).toMatchObject({ palifico: false });
    }

    const { views } = t.roundLostBy(ana);

    expect(views.size).toBe(3);
    for (const view of views.values()) {
      expect(view.game).toMatchObject({
        round: 5,
        palifico: true,
        opener: ana,
        turn: ana,
        players: [
          { id: ana, dieCount: 1 },
          { id: ben, dieCount: 5 },
          { id: cat, dieCount: 5 },
        ],
      });
    }
  });

  it("applies with only 2 players, and again every time a player drops from 2 dice to 1", () => {
    const t = table("Ana", "Ben");
    const [ana, ben] = t.ids as [PlayerId, PlayerId];
    for (let dice = 5; dice > 1; dice--) t.roundLostBy(ana);
    expect(t.game()).toMatchObject({ round: 5, palifico: true, opener: ana });

    // Ben loses the Palifico Round: back to a normal Round, which he opens.
    t.roundLostBy(ben);
    expect(t.game()).toMatchObject({ round: 6, palifico: false, opener: ben });
    t.roundLostBy(ben);
    t.roundLostBy(ben);
    expect(t.game()).toMatchObject({ round: 8, palifico: false, players: [{ dieCount: 1 }, { dieCount: 2 }] });

    const { views } = t.roundLostBy(ben);

    for (const view of views.values()) {
      expect(view.game).toMatchObject({
        round: 9,
        palifico: true,
        opener: ben,
        turn: ben,
        players: [
          { id: ana, dieCount: 1 },
          { id: ben, dieCount: 1 },
        ],
      });
    }
  });
});

describe("calling Dudo in a Palifico Round", () => {
  // Round 5 dice: 6s are Ben 1 + Cat 2 = 3. With Pacos wild (Ana 1, Ben 2, Cat 1) it would be 7.
  const ANA: Face[] = [1];
  const BEN: Face[] = [6, 1, 1, 3, 4];
  const CAT: Face[] = [6, 6, 1, 2, 5];

  it("counts Pacos only as themselves, and the reveal marks only the dice that count", () => {
    const { room, ana, ben, cat } = anasPalificoRound([...ANA, ...BEN, ...CAT]);
    mustAccept(room, { type: "bid", by: ana, count: 1, face: 6 });
    mustAccept(room, { type: "bid", by: ben, count: 4, face: 6 });

    const { result, views } = room.dispatch({ type: "dudo", by: cat });

    expect(result).toEqual({ ok: true });
    for (const view of views.values()) {
      expect(view.game).toMatchObject({
        phase: "reveal",
        palifico: true,
        players: [{ dieCount: 1 }, { dieCount: 4 }, { dieCount: 5 }],
        reveal: {
          players: [
            { id: ana, dice: [{ face: 1, counts: false }] },
            { id: ben, dice: BEN.map((face) => ({ face, counts: face === 6 })) },
            { id: cat, dice: CAT.map((face) => ({ face, counts: face === 6 })) },
          ],
          outcome: { actualCount: 3, dieChange: { player: ben, delta: -1 }, nextOpener: ben },
        },
      });
    }
  });

  it("counts Pacos toward a Bid on Pacos", () => {
    const { room, ana, ben, cat } = anasPalificoRound([...ANA, ...BEN, ...CAT]);
    mustAccept(room, { type: "bid", by: ana, count: 4, face: 1 });
    mustAccept(room, { type: "bid", by: ben, count: 5, face: 1 });

    const { views } = room.dispatch({ type: "dudo", by: cat });

    expect(views.get(ana)?.game?.reveal).toMatchObject({
      players: [{ dice: [{ face: 1, counts: true }] }, {}, {}],
      outcome: { actualCount: 4, dieChange: { player: ben, delta: -1 } },
    });
  });
});

describe("bidding in a Palifico Round", () => {
  it.each<[string, Face]>([
    ["Pacos", 1],
    ["any other Face", 6],
  ])("lets the Opener open on %s", (_, face) => {
    const { room, ana, ben } = anasPalificoRound();

    const { result, views } = room.dispatch({ type: "bid", by: ana, count: 2, face });

    expect(result).toEqual({ ok: true });
    expect(views.get(ben)?.game).toMatchObject({ bids: [{ by: ana, count: 2, face }], turn: ben });
  });

  it.each<[string, number, Face]>([
    ["a higher count on another Face", 3, 5],
    ["the same count on a higher Face", 2, 5],
    ["a switch to Pacos", 1, 1],
    ["the same count on the same Face", 2, 4],
  ])("rejects %s after the opening Bid", (_, count, face) => {
    const { room, ana, ben } = anasPalificoRound();
    mustAccept(room, { type: "bid", by: ana, count: 2, face: 4 });
    const before = room.views();

    const { result, views } = room.dispatch({ type: "bid", by: ben, count, face });

    expect(result).toMatchObject({ ok: false, error: { code: "illegal-bid" } });
    expect(views).toEqual(before);
  });

  it("accepts a higher count on the opening Face, Pacos included", () => {
    const { room, ana, ben, cat } = anasPalificoRound();
    mustAccept(room, { type: "bid", by: ana, count: 1, face: 1 });
    mustAccept(room, { type: "bid", by: ben, count: 2, face: 1 });

    const { result, views } = room.dispatch({ type: "bid", by: cat, count: 4, face: 1 });

    expect(result).toEqual({ ok: true });
    expect(views.get(ana)?.game?.bids.map((b) => [b.count, b.face])).toEqual([
      [1, 1],
      [2, 1],
      [4, 1],
    ]);
  });
});
