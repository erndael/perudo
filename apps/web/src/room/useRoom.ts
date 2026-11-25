// The browser side of the Room connection. Holds the latest full view snapshot
// from the server; components render from `view` and act through `send`.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, PlayerId, RoomView, ServerMessage, WireError } from "@perudo/server/protocol";

export interface RoomConnection {
  /** Latest snapshot; null until joined. */
  view: RoomView | null;
  playerId: PlayerId | null;
  /** Last rejection from the server, cleared by the next successful view. */
  error: WireError | null;
  join(nickname: string): void;
  send(message: ClientMessage): void;
}

function socketUrl(): string {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}/ws`;
}

export function useRoom(code: string): RoomConnection {
  const socket = useRef<WebSocket | null>(null);
  const [view, setView] = useState<RoomView | null>(null);
  const [playerId, setPlayerId] = useState<PlayerId | null>(null);
  const [error, setError] = useState<WireError | null>(null);

  useEffect(() => () => socket.current?.close(), []);

  const send = useCallback((message: ClientMessage) => {
    socket.current?.send(JSON.stringify(message));
  }, []);

  const join = useCallback(
    (nickname: string) => {
      socket.current?.close();
      const ws = new WebSocket(socketUrl());
      socket.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: "join", code, nickname } satisfies ClientMessage));
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (message.type === "joined") setPlayerId(message.playerId);
        if (message.type === "view") {
          setView(message.view);
          setError(null);
        }
        if (message.type === "error") setError(message.error);
      };
    },
    [code],
  );

  return { view, playerId, error, join, send };
}
