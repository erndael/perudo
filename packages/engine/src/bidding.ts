import type { Face } from "./dice.ts";
import { isPalifico, totalDice, type Game, type PlayerId } from "./game.ts";

/** A claim that at least `count` dice, across all players, show `face`. */
export interface Bid {
  count: number;
  face: Face;
}

/** A Bid as made in a Round: who made it. */
export interface PlacedBid extends Bid {
  by: PlayerId;
}

/** What decides whether a Bid is legal at this point of a Round. */
export interface BidRules {
  /** The current (latest) Bid of the Round, or null when the next Bid opens the Round. */
  current: Bid | null;
  /** Total dice in play: no Bid count may exceed it. */
  totalDice: number;
  /**
   * Whether this is a Palifico Round: the opening Bid may be on any Face (Pacos included),
   * and every later Bid must keep that Face with a higher count.
   */
  palifico: boolean;
}

/** The rules for the next Bid in `game`'s current Round. */
export function bidRulesFor(game: Game): BidRules {
  return {
    current: game.round.bids.at(-1) ?? null,
    totalDice: totalDice(game),
    palifico: isPalifico(game),
  };
}

/**
 * Whether `bid` may be made next. Accepts untrusted input: anything that isn't a whole
 * count from 1 to the total dice in play on a Face from 1 to 6 is illegal.
 */
export function isLegalBid(bid: Bid, rules: BidRules): boolean {
  const { count, face } = bid;
  if (!Number.isInteger(count) || count < 1 || count > rules.totalDice) return false;
  if (!Number.isInteger(face) || face < 1 || face > 6) return false;
  const { current } = rules;

  if (rules.palifico) {
    // Any opening Face, Pacos included; then the Face is locked and only the count goes up.
    return current === null || (face === current.face && count > current.count);
  }
  if (current === null) return face !== PACO;
  if (current.face === PACO) {
    return face === PACO ? count > current.count : count >= 2 * current.count + 1;
  }
  if (face === PACO) return count >= Math.ceil(current.count / 2);
  // Faces rank 2 < 3 < 4 < 5 < 6, so for non-Paco Faces the numeric order is the rank.
  return count > current.count || (count === current.count && face > current.face);
}

const PACO: Face = 1;

/**
 * The player whose Turn it is makes `bid`, and the Turn passes to the next Seat
 * that still has dice. Doesn't check legality: callers check `isLegalBid` first.
 */
export function placeBid(game: Game, bid: Bid): Game {
  const by = game.round.turn;
  return {
    ...game,
    round: {
      ...game.round,
      bids: [...game.round.bids, { by, count: bid.count, face: bid.face }],
      turn: nextSeatWithDice(game, by),
    },
  };
}

/** The next player after `id` in Seat order (wrapping round) who still has dice. */
function nextSeatWithDice(game: Game, id: PlayerId): PlayerId {
  const seat = game.players.findIndex((p) => p.id === id);
  for (let step = 1; step <= game.players.length; step++) {
    const next = game.players[(seat + step) % game.players.length]!;
    if (next.dice.length > 0) return next.id;
  }
  return id;
}
