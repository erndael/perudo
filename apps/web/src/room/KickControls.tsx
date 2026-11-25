import type { ClientMessage, RoomView } from "@perudo/server/protocol";

/**
 * Host only: a Kick button for everyone else in the Room, at any time. Kicking has the same
 * effect as the player leaving (a Round in progress is cancelled and everyone re-rolls).
 */
export function KickControls({ view, send }: { view: RoomView; send(message: ClientMessage): void }) {
  if (view.you !== view.hostId) return null;
  const others = view.people.filter((p) => p.id !== view.you);
  if (others.length === 0) return null;

  return (
    <section className="kick-controls" aria-labelledby="kick-heading">
      <h3 id="kick-heading">Kick a player</h3>
      {others.map((person) => (
        <button key={person.id} type="button" onClick={() => send({ type: "kick", player: person.id })}>
          Kick {person.nickname}
        </button>
      ))}
    </section>
  );
}
