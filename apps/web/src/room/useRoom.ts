// The browser side of the Room connection. Holds the latest full view snapshot
// from the server; components render from `view` and act through `send`.
// The reconnect token from the server is kept per Room code in localStorage, so a
// refresh or a dropped connection puts the player back in their Seat.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CLOSE_KICKED,
  CLOSE_LEFT,
  CLOSE_REPLACED,
  type ClientMessage,
  type PlayerId,
  type RoomView,
  type ServerMessage,
  type WireError,
} from "@perudo/server/protocol";
import { hostKeys, reconnectTokens as tokens } from "./roomStorage.ts";

const RETRY_MS = 1000;

export type ConnectionStatus =
  /** Not in the Room: show the nickname form. */
  | "idle"
  /** Has a Seat (or a stored token) and is trying to get back to it. */
  | "reconnecting"
  | "connected"
  /** The Seat was taken over by another tab; this one stops. */
  | "replaced"
  /** Left the Room (Seat gone): show the nickname form again. */
  | "left"
  /** Kicked by the Host (Seat gone): show the nickname form again. */
  | "kicked";

export interface RoomConnection {
  /** Latest snapshot; null until joined. Kept while reconnecting. */
  view: RoomView | null;
  playerId: PlayerId | null;
  status: ConnectionStatus;
  /** Last rejection from the server, cleared by the next successful view. */
  error: WireError | null;
  join(nickname: string): void;
  send(message: ClientMessage): void;
  /** Leave the Room for good: the Seat and the reconnect token are given up. */
  leave(): void;
}

function socketUrl(): string {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}/ws`;
}

export function useRoom(code: string): RoomConnection {
  const socket = useRef<WebSocket | null>(null);
  const connect = useRef<(first: ClientMessage) => void>(() => {});
  const [view, setView] = useState<RoomView | null>(null);
  const [playerId, setPlayerId] = useState<PlayerId | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(() => (tokens.load(code) ? "reconnecting" : "idle"));
  const [error, setError] = useState<WireError | null>(null);

  useEffect(() => {
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    connect.current = (first) => {
      clearTimeout(retry);
      const ws = new WebSocket(socketUrl());
      const old = socket.current;
      socket.current = ws;
      old?.close();
      let seated = false;

      ws.onopen = () => ws.send(JSON.stringify(first));
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (message.type === "joined") {
          seated = true;
          tokens.save(code, message.reconnectToken);
          // Single use: the server has made this browser Host (or someone already used the key).
          if (first.type === "join") hostKeys.forget(code);
          setPlayerId(message.playerId);
          setStatus("connected");
        }
        if (message.type === "view") {
          setView(message.view);
          setError(null);
        }
        if (message.type === "error") {
          if (first.type === "reconnect" && !seated) {
            // The Seat is gone (or the Room is): start over with the nickname form.
            tokens.forget(code);
            setView(null);
            setStatus("idle");
            if (message.error.code === "invalid-token") return;
          }
          setError(message.error);
        }
      };
      ws.onclose = (event) => {
        if (disposed || socket.current !== ws) return; // replaced by a newer socket, or unmounted
        socket.current = null;
        if (event.code === CLOSE_REPLACED) return setStatus("replaced");
        if (event.code === CLOSE_LEFT || event.code === CLOSE_KICKED) {
          tokens.forget(code);
          setView(null);
          setPlayerId(null);
          return setStatus(event.code === CLOSE_LEFT ? "left" : "kicked");
        }
        const token = tokens.load(code);
        if (!token) return setStatus("idle");
        setStatus("reconnecting");
        retry = setTimeout(() => connect.current({ type: "reconnect", code, token }), RETRY_MS);
      };
    };

    const token = tokens.load(code);
    if (token) connect.current({ type: "reconnect", code, token });

    return () => {
      disposed = true;
      clearTimeout(retry);
      const ws = socket.current;
      socket.current = null;
      ws?.close();
    };
  }, [code]);

  const send = useCallback((message: ClientMessage) => {
    socket.current?.send(JSON.stringify(message));
  }, []);

  const join = useCallback(
    (nickname: string) => connect.current({ type: "join", code, nickname, hostKey: hostKeys.load(code) ?? undefined }),
    [code],
  );

  const leave = useCallback(() => send({ type: "leave" }), [send]);

  return { view, playerId, status, error, join, send, leave };
}
