import { describe, expect, it } from "vitest";
import type { Room } from "./index.ts";
import { fakeClock, newRoom, rolls, scriptedRng } from "./test-helpers.ts";

const HOST_GRACE_MS = 30_000;

/** Joins everyone and returns their ids and reconnect tokens by nickname. */
function seat<N extends string>(room: Room, ...nicknames: N[]) {
  const people = {} as Record<N, { id: string; token: string }>;
  for (const nickname of nicknames) {
    const { result } = room.dispatch({ type: "join", nickname });
    if (!result.ok || !result.playerId || !result.reconnectToken) throw new Error(`join as ${nickname} failed`);
    people[nickname] = { id: result.playerId, token: result.reconnectToken };
  }
  return people;
}

const hostSeenBy = (room: Room, viewer: string) => room.views().get(viewer)?.hostId;

describe("Host handover after the Host has been disconnected for 30 seconds", () => {
  it("passes the Host role to the next connected player in Seat order", () => {
    const clock = fakeClock();
    const room = newRoom({ clock });
    const { Ana, Ben, Cat } = seat(room, "Ana", "Ben", "Cat");
    room.dispatch({ type: "disconnect", by: Ana.id });
    room.dispatch({ type: "disconnect", by: Ben.id });

    clock.advance(HOST_GRACE_MS);
    const { views } = room.dispatch({ type: "tick" });

    expect(views.get(Cat.id)?.hostId).toBe(Cat.id);
  });

  it("keeps the Host role until the full 30 seconds have passed", () => {
    const clock = fakeClock();
    const room = newRoom({ clock });
    const { Ana, Ben } = seat(room, "Ana", "Ben");
    room.dispatch({ type: "disconnect", by: Ana.id });

    clock.advance(HOST_GRACE_MS - 1);
    room.dispatch({ type: "tick" });

    expect(hostSeenBy(room, Ben.id)).toBe(Ana.id);
  });

  it("wraps around the table: after the last Seat comes the first", () => {
    const clock = fakeClock();
    const room = newRoom({ clock });
    const { Ana, Ben, Cat } = seat(room, "Ana", "Ben", "Cat");
    room.dispatch({ type: "disconnect", by: Ana.id });
    clock.advance(HOST_GRACE_MS);
    room.dispatch({ type: "tick" }); // Ben is Host now
    room.dispatch({ type: "reconnect", token: Ana.token });
    room.dispatch({ type: "disconnect", by: Cat.id });
    room.dispatch({ type: "disconnect", by: Ben.id });

    clock.advance(HOST_GRACE_MS);
    room.dispatch({ type: "tick" });

    expect(hostSeenBy(room, Ana.id)).toBe(Ana.id);
  });

  it("lets a Host who comes back within 30 seconds keep the role, and starts the count afresh next time", () => {
    const clock = fakeClock();
    const room = newRoom({ clock });
    const { Ana, Ben } = seat(room, "Ana", "Ben");
    room.dispatch({ type: "disconnect", by: Ana.id });
    clock.advance(HOST_GRACE_MS - 1000);
    room.dispatch({ type: "reconnect", token: Ana.token });
    room.dispatch({ type: "disconnect", by: Ana.id });

    clock.advance(HOST_GRACE_MS - 1);
    room.dispatch({ type: "tick" });

    expect(hostSeenBy(room, Ben.id)).toBe(Ana.id);
  });

  it("happens even if no tick arrives in time: the next command finds the Host gone too long", () => {
    const clock = fakeClock();
    const room = newRoom({ clock, rng: scriptedRng(0, ...rolls(1, 2, 3, 4, 5), ...rolls(6, 6, 6, 6, 6)) });
    const { Ana, Ben } = seat(room, "Ana", "Ben");
    room.dispatch({ type: "disconnect", by: Ana.id });
    clock.advance(HOST_GRACE_MS);

    const { result, views } = room.dispatch({ type: "start-game", by: Ben.id });

    expect(result).toEqual({ ok: true });
    expect(views.get(Ben.id)).toMatchObject({ hostId: Ben.id, game: { yourDice: [6, 6, 6, 6, 6] } });
  });

  it("waits for someone to connect when nobody is, then passes the role to them", () => {
    const clock = fakeClock();
    const room = newRoom({ clock });
    const { Ana, Ben, Cat } = seat(room, "Ana", "Ben", "Cat");
    for (const p of [Ana, Ben, Cat]) room.dispatch({ type: "disconnect", by: p.id });
    clock.advance(HOST_GRACE_MS);
    room.dispatch({ type: "tick" });

    const { views } = room.dispatch({ type: "reconnect", token: Cat.token });

    expect(views.get(Cat.id)?.hostId).toBe(Cat.id);
  });
});

describe("a former Host who reconnects after losing the role", () => {
  it("comes back as a normal player and can't start a Game", () => {
    const clock = fakeClock();
    const room = newRoom({ clock });
    const { Ana, Ben } = seat(room, "Ana", "Ben");
    room.dispatch({ type: "disconnect", by: Ana.id });
    clock.advance(HOST_GRACE_MS);
    room.dispatch({ type: "tick" });

    const { views } = room.dispatch({ type: "reconnect", token: Ana.token });
    clock.advance(10 * HOST_GRACE_MS);
    const start = room.dispatch({ type: "start-game", by: Ana.id });

    expect(views.get(Ana.id)?.hostId).toBe(Ben.id);
    expect(start.result).toMatchObject({ ok: false, error: { code: "not-host" } });
    expect(hostSeenBy(room, Ana.id)).toBe(Ben.id);
  });

  it("is still a normal player when they return even later than 30 seconds without anyone ticking", () => {
    const clock = fakeClock();
    const room = newRoom({ clock });
    const { Ana, Ben } = seat(room, "Ana", "Ben");
    room.dispatch({ type: "disconnect", by: Ana.id });
    clock.advance(5 * HOST_GRACE_MS);

    const { views } = room.dispatch({ type: "reconnect", token: Ana.token });

    expect(views.get(Ana.id)?.hostId).toBe(Ben.id);
  });
});
