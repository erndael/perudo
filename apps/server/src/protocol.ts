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

/** HTTP: GET /api/rooms/<code> -> 200 RoomExistsResponse, or 404 with `ROOM_NOT_FOUND` (unknown or expired). */
export interface RoomExistsResponse {
  code: string;
}

/** Sent for a Room code that was never created or whose Room has expired. */
export const ROOM_NOT_FOUND: WireError = {
  code: "room-not-found",
  message: "This Room doesn't exist or has expired.",
};
