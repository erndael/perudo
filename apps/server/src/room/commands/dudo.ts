import { callDudo } from "@perudo/engine";
import { reject, type CommandResult, type PlayerId, type RoomState } from "../types.ts";

export interface DudoCommand {
  type: "dudo";
  by: PlayerId;
}

/** The player whose Turn it is calls Dudo on the current Bid: the Round ends in a reveal. */
export function dudo(state: RoomState, command: DudoCommand): CommandResult {
  if (!state.game) return reject("no-game", "There is no Game in progress.");
  if (state.game.round.outcome) return reject("round-over", "This Round is over.");
  if (command.by !== state.game.round.turn) return reject("not-your-turn", "It isn't your Turn.");
  if (state.game.round.bids.length === 0) return reject("no-bid", "There is no Bid to call Dudo on yet.");
  state.game = callDudo(state.game);
  return { ok: true };
}
