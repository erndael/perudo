// Thin `ws` adapter: translates messages into Room commands and sends every
// connected player their latest full view after each command. No game rules here.
// A closed connection becomes a `disconnect` command; a timer then sends `tick` so
// time-based rules (Host handover) apply even if nobody does anything.
import type { WebSocket, WebSocketServer } from "ws";
import {
  CLOSE_KICKED,
  CLOSE_LEFT,
  CLOSE_REPLACED,
  ROOM_NOT_FOUND,
  TRANSPORT_COMMAND_TYPES,
  type ClientMessage,
  type ServerMessage,
  type WireError,
} from "./protocol.ts";
import type { Registry } from "./registry.ts";
import { HOST_DISCONNECT_GRACE_MS, type PlayerId, type Room, type RoomCommand, type RoomView } from "./room/index.ts";

const TRANSPORT_ONLY: ReadonlySet<string> = new Set(TRANSPORT_COMMAND_TYPES);

export function attachTransport(wss: WebSocketServer, registry: Registry): void {
  /** room code -> player id -> socket */
  const sockets = new Map<string, Map<PlayerId, WebSocket>>();

  const send = (ws: WebSocket, message: ServerMessage) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  };
  const sendError = (ws: WebSocket, error: WireError) => send(ws, { type: "error", error });

  const broadcast = (room: Room, views: Map<PlayerId, RoomView>) => {
    const inRoom = sockets.get(room.code);
    for (const [playerId, view] of views) {
      const ws = inRoom?.get(playerId);
      if (ws) send(ws, { type: "view", view });
    }
  };

  /**
   * Everyone with an open socket is connected, so is in `views` unless they've just left the
   * Room or been kicked: close their socket (no `disconnect` follows: it's no longer mapped).
   */
  const dropDeparted = (room: Room, views: Map<PlayerId, RoomView>, code: number) => {
    const inRoom = sockets.get(room.code);
    if (!inRoom) return;
    for (const [playerId, ws] of inRoom) {
      if (views.has(playerId)) continue;
      inRoom.delete(playerId);
      ws.close(code, code === CLOSE_KICKED ? "The Host kicked you from the Room." : "You left the Room.");
    }
    if (inRoom.size === 0) sockets.delete(room.code);
  };

  wss.on("connection", (ws) => {
    let bound: { room: Room; playerId: PlayerId } | null = null;

    ws.on("message", (data) => {
      let message: ClientMessage;
      try {
        message = JSON.parse(String(data));
      } catch {
        return sendError(ws, { code: "bad-message", message: "Malformed message." });
      }
      if (typeof message !== "object" || message === null) {
        return sendError(ws, { code: "bad-message", message: "Malformed message." });
      }

      if (message.type === "join" || message.type === "reconnect") {
        if (bound) return sendError(ws, { code: "already-joined", message: "You are already in a Room." });
        const room = registry.get(String(message.code));
        if (!room) return sendError(ws, ROOM_NOT_FOUND);
        const { result, views } = room.dispatch(
          message.type === "join"
            ? { type: "join", nickname: message.nickname, hostKey: message.hostKey }
            : { type: "reconnect", token: message.token },
        );
        if (!result.ok) return sendError(ws, result.error);
        if (!result.playerId || !result.reconnectToken) throw new Error(`${message.type} succeeded without a Seat`);
        bound = { room, playerId: result.playerId };
        if (!sockets.has(room.code)) sockets.set(room.code, new Map());
        const inRoom = sockets.get(room.code)!;
        // A refresh can reconnect before the old connection closes: the new one takes over.
        const previous = inRoom.get(result.playerId);
        inRoom.set(result.playerId, ws);
        previous?.close(CLOSE_REPLACED, "Your Seat was opened elsewhere.");
        send(ws, { type: "joined", playerId: result.playerId, reconnectToken: result.reconnectToken });
        return broadcast(room, views);
      }

      // Not bound, or no longer: this socket's player has left or been kicked.
      if (!bound || sockets.get(bound.room.code)?.get(bound.playerId) !== ws) {
        return sendError(ws, { code: "not-joined", message: "Join a Room first." });
      }
      if (TRANSPORT_ONLY.has(message.type)) {
        return sendError(ws, { code: "bad-message", message: "Unknown message." });
      }
      const command = { ...message, by: bound.playerId } as RoomCommand;
      const { result, views } = bound.room.dispatch(command);
      if (!result.ok) sendError(ws, result.error);
      dropDeparted(bound.room, views, command.type === "kick" ? CLOSE_KICKED : CLOSE_LEFT);
      broadcast(bound.room, views);
    });

    ws.on("close", () => {
      if (!bound) return;
      const { room, playerId } = bound;
      const inRoom = sockets.get(room.code);
      // Replaced by a newer connection for the same Seat: that one is still connected.
      if (inRoom?.get(playerId) !== ws) return;
      inRoom.delete(playerId);
      if (inRoom.size === 0) sockets.delete(room.code);
      broadcast(room, room.dispatch({ type: "disconnect", by: playerId }).views);
      // If this was the Host, the role may pass on once the grace period is over.
      setTimeout(() => broadcast(room, room.dispatch({ type: "tick" }).views), HOST_DISCONNECT_GRACE_MS + 100).unref();
    });
  });
}
