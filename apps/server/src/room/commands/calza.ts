import { calzaAllowed, callCalza } from "@perudo/engine";
import { checkTurn } from "../turn.ts";
import { reject, type CommandResult, type PlayerId, type RoomState } from "../types.ts";

export interface CalzaCommand {
  type: "calza";
  by: PlayerId;
}

/** The player whose Turn it is calls Calza on the current Bid: the Round ends in a reveal. */
export function calza(state: RoomState, command: CalzaCommand): CommandResult {
  const turn = checkTurn(state, command.by);
  if (!turn.ok) return turn;
  if (!calzaAllowed(turn.game)) {
    return reject("calza-unavailable", "Calza isn't allowed in a Palifico Round or with only 2 players left.");
  }
  if (turn.game.round.bids.length === 0) return reject("no-bid", "There is no Bid to call Calza on yet.");
  state.game = callCalza(turn.game);
  return { ok: true };
}
