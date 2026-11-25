// Wire messages between browser and server over the WebSocket at /ws.
// The web app imports these via "@perudo/server/protocol": types, plus a few plain constants
// (close codes, error messages). Keep it free of runtime imports so it bundles on its own.
import type { PlayerId, RoomCommand, RoomError, RoomView } from "./room/index.ts";

export type { GamePhase, GameView, PlayerId, RevealView, RoomView } from "./room/index.ts";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Room commands only the transport sends: on connect, on close, and from timers. Clients can't send them as commands. */
export const TRANSPORT_COMMAND_TYPES = ["join", "reconnect", "disconnect", "tick"] as const;
export type TransportCommandType = (typeof TRANSPORT_COMMAND_TYPES)[number];

/** WebSocket close code: a newer connection (e.g. another tab) took over this Seat. Clients don't retry. */
export const CLOSE_REPLACED = 4000;
/** WebSocket close codes: the player left the Room, or the Host kicked them. Their Seat and token are gone. */
export const CLOSE_LEFT = 4001;
export const CLOSE_KICKED = 4002;

/**
 * First message on a connection must be `join` (a new Seat) or `reconnect` (reclaim the
 * Seat a reconnect token was issued for). After that, the client sends Room commands
 * without `by`; the transport fills `by` with the connection's player id.
 */
export type ClientMessage =
  | { type: "join"; code: string; nickname: string; hostKey?: string }
  | { type: "reconnect"; code: string; token: string }
  | DistributiveOmit<Exclude<RoomCommand, { type: TransportCommandType }>, "by">;

export type TransportErrorCode = "bad-message" | "not-joined" | "already-joined" | "room-not-found";

export interface WireError {
  code: RoomError["code"] | TransportErrorCode;
  message: string;
}

export type ServerMessage =
  /** After a join or reconnect. Keep the token (per Room code) to reclaim the Seat later. */
  | { type: "joined"; playerId: PlayerId; reconnectToken: string }
  /** The full view snapshot for this player; sent after every change. */
  | { type: "view"; view: RoomView }
  /** A command from this connection was rejected; nothing changed. */
  | { type: "error"; error: WireError };

/** HTTP: POST /api/rooms -> CreateRoomResponse */
export interface CreateRoomResponse {
  code: string;
  /** Present it on the creator's `join` to become Host (see `Room.hostKey`). Keep it secret. */
  hostKey: string;
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
