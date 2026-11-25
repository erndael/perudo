import type { RoomView } from "@perudo/server/protocol";

/** Everyone in the Room, in Seat order. */
export function PeopleList({ view }: { view: RoomView }) {
  return (
    <section>
      <h2 id="people-heading">People</h2>
      <ol aria-labelledby="people-heading" className="people">
        {view.people.map((person) => (
          <li key={person.id}>
            <span className="nickname">{person.nickname}</span>
            {person.id === view.hostId && <span className="badge"> Host</span>}
            {person.id === view.you && <span className="badge you"> You</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
