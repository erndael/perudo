import { bidRulesFor, isLegalBid, placeBid, type Face } from "@perudo/engine";
import { reject, type CommandResult, type PlayerId, type RoomState } from "../types.ts";

export interface BidCommand {
  type: "bid";
  by: PlayerId;
  count: number;
  face: Face;
}

/** The player whose Turn it is makes a Bid. */
export function bid(state: RoomState, command: BidCommand): CommandResult {
  if (!state.game) return reject("no-game", "There is no Game in progress.");
  if (state.game.round.outcome) return reject("round-over", "This Round is over.");
  if (command.by !== state.game.round.turn) return reject("not-your-turn", "It isn't your Turn.");
  const bid = { count: command.count, face: command.face };
  if (!isLegalBid(bid, bidRulesFor(state.game))) {
    return reject("illegal-bid", "That Bid isn't allowed here.");
  }
  state.game = placeBid(state.game, bid);
  return { ok: true };
}
