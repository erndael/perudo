import type { RoomView } from "@perudo/server/protocol";

/** Everyone in the Room, in Seat order, with who's disconnected, and die counts and the Opener during a Game. */
export function PeopleList({ view }: { view: RoomView }) {
  return (
    <section>
      <h2 id="people-heading">People</h2>
      <ol aria-labelledby="people-heading" className="people">
        {view.people.map((person) => {
          const player = view.game?.players.find((p) => p.id === person.id);
          return (
            <li key={person.id}>
              <span className="nickname">{person.nickname}</span>
              {person.id === view.hostId && <span className="badge"> Host</span>}
              {person.id === view.you && <span className="badge you"> You</span>}
              {person.id === view.game?.opener && <span className="badge"> Opener</span>}
              {!person.connected && <span className="badge disconnected"> Disconnected</span>}
              {player && (
                <span className="die-count">
                  {" "}
                  {player.dieCount} {player.dieCount === 1 ? "die" : "dice"}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
