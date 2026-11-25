import type { PlayerId, RoomView } from "@perudo/server/protocol";

/** A player's nickname, including people who have left the Room but still appear in the Game. */
export function nicknameOf(view: RoomView, id: PlayerId): string {
  return (view.people.find((p) => p.id === id) ?? view.departed.find((p) => p.id === id))?.nickname ?? "?";
}

/** `nicknameOf` bound to one view, for components that look up many names. */
export function nicknamesIn(view: RoomView): (id: PlayerId) => string {
  return (id) => nicknameOf(view, id);
}
