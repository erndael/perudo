import { BiddingPanel } from "./BiddingPanel.tsx";
import { GamePanel } from "./GamePanel.tsx";
import { HostControls } from "./HostControls.tsx";
import { NicknameForm } from "./NicknameForm.tsx";
import { PeopleList } from "./PeopleList.tsx";
import { RoomNotFound } from "./RoomNotFound.tsx";
import { useRoom, type ConnectionStatus } from "./useRoom.ts";
import { useRoomExists } from "./useRoomExists.ts";

const STATUS_TEXT: Partial<Record<ConnectionStatus, string>> = {
  reconnecting: "Connection lost. Reconnecting…",
  replaced: "This Room is open in another tab. Refresh to play here instead.",
};

export function RoomPage({ code }: { code: string }) {
  const existence = useRoomExists(code);
  const { view, status, error, join, send } = useRoom(code);

  if (existence.state === "missing") return <RoomNotFound message={existence.message} />;
  // The Room can expire between opening the link and joining.
  if (!view && error?.code === "room-not-found") return <RoomNotFound message={error.message} />;

  if (!view) {
    return (
      <main className="page">
        <h1>Room {code}</h1>
        {status !== "idle" ? (
          <p role="status">{status === "replaced" ? STATUS_TEXT.replaced : "Reconnecting…"}</p>
        ) : (
          existence.state === "exists" && <NicknameForm onSubmit={join} error={error?.message ?? null} />
        )}
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Room {view.code}</h1>
      {STATUS_TEXT[status] && <p role="status">{STATUS_TEXT[status]}</p>}
      <p>
        Share this link: <code>{window.location.href}</code>
      </p>
      <PeopleList view={view} />
      <HostControls view={view} send={send} />
      {view.game && <GamePanel game={view.game} />}
      <BiddingPanel view={view} send={send} />
      {error && <p role="alert">{error.message}</p>}
    </main>
  );
}
