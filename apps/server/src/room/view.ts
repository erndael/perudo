import { calzaAllowed, countsToward, dieCount, isPalifico, totalDice, winner, type Game } from "@perudo/engine";
import type { GameView, PlayerId, RevealView, RoomState, RoomView } from "./types.ts";

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
    departed: state.departed.map((d) => ({ ...d })),
  };
}

/** In the Room but not playing the Game in progress: they join the next Game. */
function isWaiting(state: RoomState, id: PlayerId): boolean {
  return state.game !== null && !state.game.players.some((p) => p.id === id);
}

/** Other players' dice must never leave this function outside a reveal (ADR-0001). */
function gameViewFor(game: Game, viewer: PlayerId): GameView {
  const you = game.players.find((p) => p.id === viewer);
  const won = winner(game);
  return {
    phase: won ? "over" : game.round.outcome ? "reveal" : "bidding",
    round: game.round.number,
    opener: game.round.opener,
    turn: game.round.turn,
    bids: game.round.bids.map(({ by, count, face }) => ({ by, count, face })),
    palifico: isPalifico(game),
    calzaAvailable: calzaAllowed(game),
    totalDice: totalDice(game),
    players: game.players.map((p) => ({ id: p.id, dieCount: dieCount(game, p.id) })),
    yourDice: you ? [...you.dice] : null,
    reveal: revealViewFor(game),
    winner: won,
  };
}

/** Everyone's dice, with the counting ones marked. Only once the Round has an outcome (the reveal). */
function revealViewFor(game: Game): RevealView | null {
  const { outcome } = game.round;
  if (!outcome) return null;
  const palifico = isPalifico(game);
  return {
    players: game.players.map((p) => ({
      id: p.id,
      dice: p.dice.map((face) => ({ face, counts: countsToward(face, outcome.bid.face, palifico) })),
    })),
    outcome: { ...outcome, bid: { ...outcome.bid }, dieChange: { ...outcome.dieChange } },
  };
}
