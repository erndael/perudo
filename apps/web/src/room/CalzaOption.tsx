import type { ClientMessage, RoomView } from "@perudo/server/protocol";

/**
 * The Room's Calza option, shown to everyone. The Host can switch it on or off before a Game
 * (and between Games); the server rejects changes during one.
 */
export function CalzaOption({ view, send }: { view: RoomView; send(message: ClientMessage): void }) {
  const changeable = view.you === view.hostId && (!view.game || view.game.phase === "over");

  return (
    <section className="room-options">
      {changeable && (
        <label>
          <input
            type="checkbox"
            checked={view.calzaEnabled}
            onChange={(e) => send({ type: "set-calza", enabled: e.target.checked })}
          />
          Calza
        </label>
      )}
      <span className="hint">{view.calzaEnabled ? "Calza is on." : "Calza is off."}</span>
    </section>
  );
}
