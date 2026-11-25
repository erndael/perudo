import { MIN_PLAYERS } from "@perudo/engine";
import type { ClientMessage, RoomView } from "@perudo/server/protocol";

/** Controls only the Host sees. Renders nothing for everyone else. */
export function HostControls({ view, send }: { view: RoomView; send(message: ClientMessage): void }) {
  if (view.you !== view.hostId) return null;

  const enoughPlayers = view.people.length >= MIN_PLAYERS;
  if (view.game?.phase === "over") {
    // A rematch is a new Game in this Room: everyone here plays, in join order.
    return (
      <section className="host-controls">
        <button type="button" disabled={!enoughPlayers} onClick={() => send({ type: "start-game" })}>
          Start rematch
        </button>
        {!enoughPlayers && <p className="hint">Waiting for at least {MIN_PLAYERS} players.</p>}
      </section>
    );
  }

  if (view.game) {
    if (view.game.phase !== "reveal") return null;
    return (
      <section className="host-controls">
        <button type="button" onClick={() => send({ type: "start-next-round" })}>
          Start next Round
        </button>
      </section>
    );
  }

  return (
    <section className="host-controls">
      <button type="button" disabled={!enoughPlayers} onClick={() => send({ type: "start-game" })}>
        Start Game
      </button>
      {!enoughPlayers && <p className="hint">Waiting for at least {MIN_PLAYERS} players.</p>}
    </section>
  );
}
