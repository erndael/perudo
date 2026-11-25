import { calzaAllowed, callCalza } from "@perudo/engine";
import { reject, type CommandResult, type PlayerId, type RoomState } from "../types.ts";

export interface CalzaCommand {
  type: "calza";
  by: PlayerId;
}

/** The player whose Turn it is calls Calza on the current Bid: the Round ends in a reveal. */
export function calza(state: RoomState, command: CalzaCommand): CommandResult {
  if (!state.game) return reject("no-game", "There is no Game in progress.");
  if (state.game.round.outcome) return reject("round-over", "This Round is over.");
  if (command.by !== state.game.round.turn) return reject("not-your-turn", "It isn't your Turn.");
  if (!state.calzaEnabled) return reject("calza-disabled", "Calza is switched off in this Room.");
  if (!calzaAllowed(state.game)) {
    return reject("calza-unavailable", "Calza isn't allowed in a Palifico Round or with only 2 players left.");
  }
  if (state.game.round.bids.length === 0) return reject("no-bid", "There is no Bid to call Calza on yet.");
  state.game = callCalza(state.game);
  return { ok: true };
}
