import { totalDice, type Game } from "@perudo/engine";
import type { GameView, PlayerId, RoomState, RoomView } from "./types.ts";

/** Builds what `viewer` may see. The only place that decides visibility. */
export function viewFor(state: RoomState, viewer: PlayerId): RoomView {
  return {
    code: state.code,
    you: viewer,
    hostId: state.hostId,
    people: state.people.map(({ id, nickname, connected }) => ({
      id,
      nickname,
      waiting: isWaiting(state, id),
      connected,
    })),
    game: state.game && gameViewFor(state.game, viewer),
  };
}

/** In the Room but not playing the Game in progress: they join the next Game. */
function isWaiting(state: RoomState, id: PlayerId): boolean {
  return state.game !== null && !state.game.players.some((p) => p.id === id);
}

/** Other players' dice must never leave this function outside a reveal (ADR-0001). */
function gameViewFor(game: Game, viewer: PlayerId): GameView {
  const you = game.players.find((p) => p.id === viewer);
  return {
    round: game.round.number,
    opener: game.round.opener,
    turn: game.round.turn,
    bids: game.round.bids.map(({ by, count, face }) => ({ by, count, face })),
    palifico: game.round.palifico,
    totalDice: totalDice(game),
    players: game.players.map((p) => ({ id: p.id, dieCount: p.dice.length })),
    yourDice: you ? [...you.dice] : null,
  };
}
