// Wire messages between browser and server over the WebSocket at /ws.
// The web app imports these types (type-only) via "@perudo/server/protocol".
import type { PlayerId, RoomCommand, RoomError, RoomView } from "./room/index.ts";

export type { GameView, PlayerId, RoomView } from "./room/index.ts";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * First message on a connection must be `join`. After that, the client sends Room
 * commands without `by`; the transport fills `by` with the connection's player id.
 */
export type ClientMessage =
  | { type: "join"; code: string; nickname: string }
  | DistributiveOmit<Exclude<RoomCommand, { type: "join" }>, "by">;

export type TransportErrorCode = "bad-message" | "not-joined" | "already-joined" | "room-not-found";

export interface WireError {
  code: RoomError["code"] | TransportErrorCode;
  message: string;
}

export type ServerMessage =
  | { type: "joined"; playerId: PlayerId }
  /** The full view snapshot for this player; sent after every change. */
  | { type: "view"; view: RoomView }
  /** A command from this connection was rejected; nothing changed. */
  | { type: "error"; error: WireError };

/** HTTP: POST /api/rooms -> CreateRoomResponse */
export interface CreateRoomResponse {
  code: string;
}
