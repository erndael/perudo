import { describe, expect, it } from "vitest";
import type { PlayerId, Room } from "./index.ts";
import { joinAs, newRoom, scriptedRng } from "./test-helpers.ts";

/**
 * Every Opener Seat is 0 and every die rolls a 2 (raw rng value 1 for both), so a Bid of
 * 1 × 6 is always wrong: whoever opens with it loses a die when the next player calls Dudo,
 * and opens again.
 */
function allTwosRng() {
  return scriptedRng(0, ...Array<number>(500).fill(1));
}

function mustAccept(room: Room, command: Parameters<Room["dispatch"]>[0]) {
  const { result } = room.dispatch(command);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}`);
}

/** Starts a Game with everyone who has joined, as `host`; Seat 0 opens. */
function gameWith(...nicknames: string[]) {
  const room = newRoom({ rng: allTwosRng() });
  const ids = nicknames.map((n) => joinAs(room, n));
  mustAccept(room, { type: "start-game", by: ids[0]! });
  return { room, ids };
}

/**
 * Plays `times` Rounds in which `loser` opens with 1 × 6 (wrong: every die is a 2), the next
 * player calls Dudo, and `loser` loses a die. Leaves the Game in the last Round's reveal.
 */
function loseRounds(room: Room, host: PlayerId, loser: PlayerId, caller: PlayerId, times: number) {
  for (let i = 0; i < times; i++) {
    if (i > 0) mustAccept(room, { type: "start-next-round", by: host });
    mustAccept(room, { type: "bid", by: loser, count: 1, face: 6 });
    mustAccept(room, { type: "dudo", by: caller });
  }
}

describe("elimination", () => {
  it("leaves a player who loses their last die with no dice and no Turns, still watching", () => {
    const { room, ids } = gameWith("Ana", "Ben", "Cat");
    const [ana, ben, cat] = ids as [PlayerId, PlayerId, PlayerId];
    loseRounds(room, ana, ana, ben, 5);

    // Ana would open (she lost the die), but she's Eliminated: Ben, next in Seat order, opens.
    const { views } = room.dispatch({ type: "start-next-round", by: ana });

    expect(views.get(ana)?.game).toMatchObject({
      phase: "bidding",
      round: 6,
      opener: ben,
      turn: ben,
      totalDice: 10,
      players: [
        { id: ana, dieCount: 0 },
        { id: ben, dieCount: 5 },
        { id: cat, dieCount: 5 },
      ],
      yourDice: [],
    });
    expect(views.get(ana)?.people.find((p) => p.id === ana)).toMatchObject({ waiting: false });

    // Turns go Ben -> Cat -> Ben: Ana is skipped and can't act.
    mustAccept(room, { type: "bid", by: ben, count: 1, face: 2 });
    const { result } = room.dispatch({ type: "bid", by: ana, count: 2, face: 2 });
    expect(result).toMatchObject({ ok: false, error: { code: "not-your-turn" } });
    mustAccept(room, { type: "bid", by: cat, count: 2, face: 2 });
    expect(room.views().get(cat)?.game?.turn).toBe(ben);
  });
});

describe("Game end", () => {
  it("ends the Game when one player has dice left, and shows everyone the winner", () => {
    const { room, ids } = gameWith("Ana", "Ben");
    const [ana, ben] = ids as [PlayerId, PlayerId];
    loseRounds(room, ana, ana, ben, 4);
    mustAccept(room, { type: "start-next-round", by: ana });
    mustAccept(room, { type: "bid", by: ana, count: 1, face: 6 });

    const { views } = room.dispatch({ type: "dudo", by: ben });

    expect(views.size).toBe(2);
    for (const view of views.values()) {
      expect(view.game).toMatchObject({
        phase: "over",
        winner: ben,
        players: [
          { id: ana, dieCount: 0 },
          { id: ben, dieCount: 5 },
        ],
        // The last reveal stays on screen.
        reveal: { outcome: { caller: ben, dieChange: { player: ana, delta: -1 } } },
      });
    }
  });

  it("has no winner while more than one player has dice", () => {
    const { room, ids } = gameWith("Ana", "Ben");
    const [ana, ben] = ids as [PlayerId, PlayerId];
    loseRounds(room, ana, ana, ben, 4);

    expect(room.views().get(ana)?.game).toMatchObject({ phase: "reveal", winner: null });
  });

  it("rejects starting another Round once the Game is over", () => {
    const { room, ids } = gameWith("Ana", "Ben");
    const [ana, ben] = ids as [PlayerId, PlayerId];
    loseRounds(room, ana, ana, ben, 5);
    const before = room.views();

    const { result, views } = room.dispatch({ type: "start-next-round", by: ana });

    expect(result).toMatchObject({ ok: false, error: { code: "game-over" } });
    expect(views).toEqual(before);
  });
});

describe("rematch", () => {
  /** Ana and Ben play until Ben wins; Cat arrives mid-Game and waits. */
  function finishedGameWithCatWaiting() {
    const { room, ids } = gameWith("Ana", "Ben");
    const [ana, ben] = ids as [PlayerId, PlayerId];
    const cat = joinAs(room, "Cat");
    loseRounds(room, ana, ana, ben, 5);
    return { room, ana, ben, cat };
  }

  it("lets the Host start a new Game with everyone in the Room, in join order", () => {
    const { room, ana, ben, cat } = finishedGameWithCatWaiting();
    expect(room.views().get(cat)?.people.map((p) => p.waiting)).toEqual([false, false, true]);

    const { result, views } = room.dispatch({ type: "start-game", by: ana });

    expect(result).toEqual({ ok: true });
    expect(views.size).toBe(3);
    for (const view of views.values()) {
      expect(view.game).toMatchObject({
        phase: "bidding",
        round: 1,
        winner: null,
        reveal: null,
        bids: [],
        totalDice: 15,
        players: [
          { id: ana, dieCount: 5 },
          { id: ben, dieCount: 5 },
          { id: cat, dieCount: 5 },
        ],
      });
      expect(view.people.map((p) => p.waiting)).toEqual([false, false, false]);
    }
    expect(views.get(cat)?.game?.yourDice).toEqual([2, 2, 2, 2, 2]);
  });

  it("is Host only", () => {
    const { room, ben } = finishedGameWithCatWaiting();
    const before = room.views();

    const { result, views } = room.dispatch({ type: "start-game", by: ben });

    expect(result).toMatchObject({ ok: false, error: { code: "not-host" } });
    expect(views).toEqual(before);
  });

  it("is rejected while the Game is still going", () => {
    const { room, ids } = gameWith("Ana", "Ben");
    const [ana, ben] = ids as [PlayerId, PlayerId];
    loseRounds(room, ana, ana, ben, 4);
    const before = room.views();

    const { result, views } = room.dispatch({ type: "start-game", by: ana });

    expect(result).toMatchObject({ ok: false, error: { code: "game-in-progress" } });
    expect(views).toEqual(before);
  });
});
