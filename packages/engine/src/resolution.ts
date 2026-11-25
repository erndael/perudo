import type { PlacedBid } from "./bidding.ts";
import type { Face } from "./dice.ts";
import type { Game, PlayerId } from "./game.ts";

const PACO: Face = 1;

/**
 * How a Round ended. Set on `Round.outcome` when the Round resolves; the Game then sits in the
 * reveal until the next Round starts. Extend `call` for Calza (ticket 07).
 */
export interface RoundOutcome {
  /** What ended the Round. */
  call: "dudo";
  /** Who called it. */
  caller: PlayerId;
  /** The Bid that was called: the current Bid when the call was made. */
  bid: PlacedBid;
  /** How many dice, across all players, count toward `bid` (see `countsToward`). */
  actualCount: number;
  /** The one die count that changes: -1 for a lost die, +1 for a gained one (Calza). */
  dieChange: { player: PlayerId; delta: number };
  /** Who opens the next Round (before skipping Eliminated players: see `startNextRound`). */
  nextOpener: PlayerId;
}

/** Whether a die showing `face` counts toward a Bid on `bidFace`. Pacos are wild except in a Palifico Round. */
export function countsToward(face: Face, bidFace: Face, palifico: boolean): boolean {
  return face === bidFace || (!palifico && face === PACO);
}

/** How many dice in play count toward a Bid on `face` this Round. */
export function actualCount(game: Game, face: Face): number {
  return game.players
    .flatMap((p) => p.dice)
    .filter((die) => countsToward(die, face, game.round.palifico)).length;
}

/**
 * The player whose Turn it is calls Dudo on the current Bid, ending the Round.
 * Actual count at least the Bid: the caller loses a die; otherwise the bidder does.
 * The loser opens the next Round. Dice stay as rolled (they are what the reveal shows);
 * die counts include the change from then on (see `dieCount`).
 * Doesn't check that a Bid exists or the Round is still open: callers check first.
 */
export function callDudo(game: Game): Game {
  const caller = game.round.turn;
  const bid = game.round.bids.at(-1)!;
  const count = actualCount(game, bid.face);
  const loser = count >= bid.count ? caller : bid.by;
  const outcome: RoundOutcome = {
    call: "dudo",
    caller,
    bid,
    actualCount: count,
    dieChange: { player: loser, delta: -1 },
    nextOpener: loser,
  };
  return { ...game, round: { ...game.round, outcome } };
}
