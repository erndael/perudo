import { bidRulesFor, isLegalBid, placeBid, type Face } from "@perudo/engine";
import { checkTurn } from "../turn.ts";
import { reject, type CommandResult, type PlayerId, type RoomState } from "../types.ts";

export interface BidCommand {
  type: "bid";
  by: PlayerId;
  count: number;
  face: Face;
}

/** The player whose Turn it is makes a Bid. */
export function bid(state: RoomState, command: BidCommand): CommandResult {
  const turn = checkTurn(state, command.by);
  if (!turn.ok) return turn;
  const bid = { count: command.count, face: command.face };
  if (!isLegalBid(bid, bidRulesFor(turn.game))) {
    return reject("illegal-bid", "That Bid isn't allowed here.");
  }
  state.game = placeBid(turn.game, bid);
  return { ok: true };
}
