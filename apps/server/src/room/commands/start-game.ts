import { MAX_PLAYERS, MIN_PLAYERS, startGame as startEngineGame, winner } from "@perudo/engine";
import { reject, type CommandResult, type PlayerId, type RoomContext, type RoomState } from "../types.ts";

export interface StartGameCommand {
  type: "start-game";
  by: PlayerId;
}

/**
 * Host only. Everyone in the Room plays, in Seat order (join order), including people who were
 * waiting. Also starts a rematch once the Game is over (it has a winner).
 */
export function startGame(state: RoomState, command: StartGameCommand, ctx: RoomContext): CommandResult {
  if (command.by !== state.hostId) return reject("not-host", "Only the Host can start a Game.");
  if (state.game && !winner(state.game)) return reject("game-in-progress", "A Game is already in progress.");
  if (state.people.length < MIN_PLAYERS) {
    return reject("not-enough-players", `A Game needs at least ${MIN_PLAYERS} players.`);
  }
  if (state.people.length > MAX_PLAYERS) {
    return reject("too-many-players", `A Game can have at most ${MAX_PLAYERS} players.`);
  }

  state.game = startEngineGame(
    state.people.map((p) => p.id),
    ctx.rng,
  );
  return { ok: true };
}
