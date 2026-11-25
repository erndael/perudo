// Leaving and kicking have the same effect: the person is removed from the Room and,
// if they were playing, Eliminated from the Game (see engine `leaveGame`).
import { leaveGame, nextInSeatOrder } from "@perudo/engine";
import type { PlayerId, RoomContext, RoomState } from "./types.ts";

/** Removes `id` (who must be in the Room) from the Room and the Game. Their reconnect token stops working. */
export function depart(state: RoomState, id: PlayerId, ctx: RoomContext): void {
  const person = state.people.find((p) => p.id === id)!;
  // Seat order is only known while they're still in `state.people`.
  if (state.hostId === id) state.hostId = nextInSeatOrder(state.people, id)?.id ?? null;
  state.people = state.people.filter((p) => p.id !== id);

  if (!state.game) return;
  state.game = leaveGame(state.game, id, ctx.rng);
  // The Game may still mention them (Seats, the reveal, the winner): keep their nickname for it.
  const game = state.game;
  const inGame = (d: { id: PlayerId }) => game.players.some((p) => p.id === d.id);
  if (inGame(person)) state.departed = [...state.departed.filter(inGame), { id, nickname: person.nickname }];
}
