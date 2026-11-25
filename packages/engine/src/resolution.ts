import type { PlacedBid } from "./bidding.ts";
import { PACO, type Face } from "./dice.ts";
import { dieCount, isPalifico, MAX_DICE, type Game, type PlayerId } from "./game.ts";

/**
 * How a Round ended. Set on `Round.outcome` when the Round resolves; the Game then sits in the
 * reveal until the next Round starts.
 */
export interface RoundOutcome {
  /** What ended the Round. */
  call: "dudo" | "calza";
  /** Who called it. */
  caller: PlayerId;
  /** The Bid that was called: the current Bid when the call was made. */
  bid: PlacedBid;
  /** How many dice, across all players, count toward `bid` (see `countsToward`). */
  actualCount: number;
  /** The one die count that changes: -1 for a lost die, +1 for a gained one (Calza), 0 for a Calza at 5 dice. */
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
    .filter((die) => countsToward(die, face, isPalifico(game))).length;
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

/** Whether the Game's rules allow Calza this Round: never in a Palifico Round, nor once only 2 players have dice. */
export function calzaAllowed(game: Game): boolean {
  const playersLeft = game.players.filter((p) => dieCount(game, p.id) > 0).length;
  return !isPalifico(game) && playersLeft > 2;
}

/**
 * The player whose Turn it is calls Calza on the current Bid, ending the Round: the actual
 * count exactly equal to the Bid gains the caller a die (never above 5, so the change may be
 * 0); otherwise the caller loses one. Only the caller's dice change, and the caller opens the
 * next Round. Dice stay as rolled, as for Dudo.
 * Doesn't check that a Bid exists, the Round is still open or Calza is allowed (see
 * `calzaAllowed`): callers check first.
 */
export function callCalza(game: Game): Game {
  const caller = game.round.turn;
  const bid = game.round.bids.at(-1)!;
  const count = actualCount(game, bid.face);
  const dice = game.players.find((p) => p.id === caller)!.dice.length;
  const delta = count !== bid.count ? -1 : dice < MAX_DICE ? 1 : 0;
  const outcome: RoundOutcome = {
    call: "calza",
    caller,
    bid,
    actualCount: count,
    dieChange: { player: caller, delta },
    nextOpener: caller,
  };
  return { ...game, round: { ...game.round, outcome } };
}
