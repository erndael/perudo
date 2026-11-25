import type { RoomView } from "@perudo/server/protocol";
import { nicknameOf } from "./names.ts";

/** The winner screen: shown to everyone once one player has dice left, until the Host starts a rematch. */
export function GameOverPanel({ view }: { view: RoomView }) {
  const winner = view.game?.phase === "over" ? view.game.winner : null;
  if (!winner) return null;
  const nickname = nicknameOf(view, winner);

  return (
    <section className="game-over" aria-labelledby="game-over-heading">
      <h2 id="game-over-heading">Game over</h2>
      <p className="winner" aria-live="polite">
        {nickname} wins the Game!
      </p>
      {view.you !== view.hostId && <p className="hint">Waiting for the Host to start a rematch.</p>}
    </section>
  );
}
