import { callDudo } from "@perudo/engine";
import { checkTurn } from "../turn.ts";
import { reject, type CommandResult, type PlayerId, type RoomState } from "../types.ts";

export interface DudoCommand {
  type: "dudo";
  by: PlayerId;
}

/** The player whose Turn it is calls Dudo on the current Bid: the Round ends in a reveal. */
export function dudo(state: RoomState, command: DudoCommand): CommandResult {
  const turn = checkTurn(state, command.by);
  if (!turn.ok) return turn;
  if (turn.game.round.bids.length === 0) return reject("no-bid", "There is no Bid to call Dudo on yet.");
  state.game = callDudo(turn.game);
  return { ok: true };
}
