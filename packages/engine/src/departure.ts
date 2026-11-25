import { rollDice, type Rng } from "./dice.ts";
import { dieCount, openerFrom, winner, type Game, type PlayerId } from "./game.ts";

/**
 * `id` leaves the Game (they left the Room or were kicked): they are Eliminated.
 *
 * - Round open (bidding) and they still had dice: the Round is cancelled with no die change.
 *   Everyone left re-rolls the same number of dice in Seat order (see `rollDice`), and the
 *   player whose Turn it was opens the new Round, or the next Seat with dice if that was the
 *   departed player (see `openerFrom`). A cancelled Palifico Round is replayed as a Palifico
 *   Round unless the player it was for (its Opener) is the one who left. No re-roll if only one
 *   player has dice left: the Game is over (see `winner`).
 * - Round resolved (the reveal): the outcome stands and the reveal keeps showing their dice;
 *   they roll none next Round.
 * - Game already over, or `id` isn't playing: nothing changes.
 */
export function leaveGame(game: Game, id: PlayerId, rng: Rng): Game {
  if (winner(game) || !game.players.some((p) => p.id === id)) return game;

  const hadDice = dieCount(game, id) > 0;
  const { round } = game;
  const reveal = round.outcome !== null;
  const departed: Game = {
    ...game,
    players: game.players.map((p) =>
      p.id === id ? { id, dice: reveal ? p.dice : [], departed: true as const } : p,
    ),
  };
  if (reveal || !hadDice || winner(departed)) return departed;

  const opener = openerFrom(departed, round.turn);
  return {
    ...departed,
    players: departed.players.map((p) => (p.id === id ? p : { ...p, dice: rollDice(p.dice.length, rng) })),
    round: {
      number: round.number + 1,
      opener,
      turn: opener,
      bids: [],
      palifico: round.palifico && round.opener !== id,
      outcome: null,
    },
  };
}
