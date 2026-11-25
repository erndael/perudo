// Thin `ws` adapter: translates messages into Room commands and sends every
// connected player their latest full view after each command. No game rules here.
import type { WebSocket, WebSocketServer } from "ws";
import { ROOM_NOT_FOUND, type ClientMessage, type ServerMessage, type WireError } from "./protocol.ts";
import type { Registry } from "./registry.ts";
import type { PlayerId, Room, RoomCommand, RoomView } from "./room/index.ts";

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

      if (message.type === "join") {
        if (bound) return sendError(ws, { code: "already-joined", message: "You are already in a Room." });
        const room = registry.get(String(message.code));
        if (!room) return sendError(ws, ROOM_NOT_FOUND);
        const { result, views } = room.dispatch({ type: "join", nickname: message.nickname });
        if (!result.ok) return sendError(ws, result.error);
        if (!result.playerId) throw new Error("join succeeded without a player id");
        bound = { room, playerId: result.playerId };
        if (!sockets.has(room.code)) sockets.set(room.code, new Map());
        sockets.get(room.code)!.set(result.playerId, ws);
        send(ws, { type: "joined", playerId: result.playerId });
        return broadcast(room, views);
      }

      if (!bound) return sendError(ws, { code: "not-joined", message: "Join a Room first." });
      const command = { ...message, by: bound.playerId } as RoomCommand;
      const { result, views } = bound.room.dispatch(command);
      if (!result.ok) sendError(ws, result.error);
      broadcast(bound.room, views);
    });

    ws.on("close", () => {
      if (!bound) return;
      const inRoom = sockets.get(bound.room.code);
      if (inRoom?.get(bound.playerId) === ws) inRoom.delete(bound.playerId);
      if (inRoom?.size === 0) sockets.delete(bound.room.code);
    });
  });
}
