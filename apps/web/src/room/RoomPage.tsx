import { GamePanel } from "./GamePanel.tsx";
import { HostControls } from "./HostControls.tsx";
import { NicknameForm } from "./NicknameForm.tsx";
import { PeopleList } from "./PeopleList.tsx";
import { useRoom, type ConnectionStatus } from "./useRoom.ts";

const STATUS_TEXT: Partial<Record<ConnectionStatus, string>> = {
  reconnecting: "Connection lost. Reconnecting…",
  replaced: "This Room is open in another tab. Refresh to play here instead.",
};

export function RoomPage({ code }: { code: string }) {
  const { view, status, error, join, send } = useRoom(code);

  if (!view) {
    return (
      <main className="page">
        <h1>Room {code}</h1>
        {status === "idle" ? (
          <NicknameForm onSubmit={join} error={error?.message ?? null} />
        ) : (
          <p role="status">{status === "replaced" ? STATUS_TEXT.replaced : "Reconnecting…"}</p>
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
      {error && <p role="alert">{error.message}</p>}
    </main>
  );
}
