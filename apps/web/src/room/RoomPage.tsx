import { BiddingPanel } from "./BiddingPanel.tsx";
import { GamePanel } from "./GamePanel.tsx";
import { HostControls } from "./HostControls.tsx";
import { NicknameForm } from "./NicknameForm.tsx";
import { PeopleList } from "./PeopleList.tsx";
import { useRoom } from "./useRoom.ts";

export function RoomPage({ code }: { code: string }) {
  const { view, error, join, send } = useRoom(code);

  if (!view) {
    return (
      <main className="page">
        <h1>Room {code}</h1>
        <NicknameForm onSubmit={join} error={error?.message ?? null} />
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Room {view.code}</h1>
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
