import { BiddingPanel } from "./BiddingPanel.tsx";
import { GameOverPanel } from "./GameOverPanel.tsx";
import { GamePanel } from "./GamePanel.tsx";
import { HostControls } from "./HostControls.tsx";
import { KickControls } from "./KickControls.tsx";
import { NicknameForm } from "./NicknameForm.tsx";
import { PeopleList } from "./PeopleList.tsx";
import { RevealPanel } from "./RevealPanel.tsx";
import { RoomNotFound } from "./RoomNotFound.tsx";
import { useRoom, type ConnectionStatus } from "./useRoom.ts";
import { useRoomExists } from "./useRoomExists.ts";

const STATUS_TEXT: Partial<Record<ConnectionStatus, string>> = {
  reconnecting: "Connection lost. Reconnecting…",
  replaced: "This Room is open in another tab. Refresh to play here instead.",
  left: "You left the Room. You can join again with a nickname.",
  kicked: "The Host kicked you from the Room. You can join again with a nickname.",
};

export function RoomPage({ code }: { code: string }) {
  const existence = useRoomExists(code);
  const { view, status, error, join, send, leave } = useRoom(code);

  if (existence.state === "missing") return <RoomNotFound message={existence.message} />;
  // The Room can expire between opening the link and joining.
  if (!view && error?.code === "room-not-found") return <RoomNotFound message={error.message} />;

  if (!view) {
    return (
      <main className="page">
        <h1>Room {code}</h1>
        {status === "left" || status === "kicked" ? (
          <>
            <p role="status">{STATUS_TEXT[status]}</p>
            <NicknameForm onSubmit={join} error={error?.message ?? null} />
          </>
        ) : status !== "idle" ? (
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
      <KickControls view={view} send={send} />
      <GameOverPanel view={view} />
      {view.game && <GamePanel game={view.game} you={view.you} />}
      <RevealPanel view={view} />
      <BiddingPanel view={view} send={send} />
      {error && <p role="alert">{error.message}</p>}
      <p>
        <button type="button" className="leave" onClick={leave}>
          Leave Room
        </button>
      </p>
    </main>
  );
}
