import type { Game } from "@perudo/engine";
import { reject, type PlayerId, type Rejection, type RoomState } from "./types.ts";

/**
 * The checks every Turn action (a Bid, Dudo, Calza) starts with: there is a Game, its Round is
 * still open, and it is `by`'s Turn. Gives the Game to act on, or the rejection to return.
 */
export function checkTurn(state: RoomState, by: PlayerId): { ok: true; game: Game } | Rejection {
  if (!state.game) return reject("no-game", "There is no Game in progress.");
  if (state.game.round.outcome) return reject("round-over", "This Round is over.");
  if (by !== state.game.round.turn) return reject("not-your-turn", "It isn't your Turn.");
  return { ok: true, game: state.game };
}
