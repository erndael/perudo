import { startNextRound as startEngineNextRound, winner } from "@perudo/engine";
import { reject, type CommandResult, type PlayerId, type RoomContext, type RoomState } from "../types.ts";

export interface StartNextRoundCommand {
  type: "start-next-round";
  by: PlayerId;
}

/** Host only, from the reveal: fresh dice for everyone, opened by whoever the outcome says. */
export function startNextRound(state: RoomState, command: StartNextRoundCommand, ctx: RoomContext): CommandResult {
  if (command.by !== state.hostId) return reject("not-host", "Only the Host can start the next Round.");
  if (!state.game) return reject("no-game", "There is no Game in progress.");
  if (winner(state.game)) return reject("game-over", "The Game is over.");
  if (!state.game.round.outcome) return reject("round-in-progress", "This Round isn't over yet.");
  state.game = startEngineNextRound(state.game, ctx.rng);
  return { ok: true };
}
