import { GamePanel } from "./GamePanel.tsx";
import { HostControls } from "./HostControls.tsx";
import { NicknameForm } from "./NicknameForm.tsx";
import { PeopleList } from "./PeopleList.tsx";
import { RoomNotFound } from "./RoomNotFound.tsx";
import { useRoom } from "./useRoom.ts";
import { useRoomExists } from "./useRoomExists.ts";

export function RoomPage({ code }: { code: string }) {
  const existence = useRoomExists(code);
  const { view, error, join, send } = useRoom(code);

  if (existence.state === "missing") return <RoomNotFound message={existence.message} />;
  // The Room can expire between opening the link and joining.
  if (!view && error?.code === "room-not-found") return <RoomNotFound message={error.message} />;

  if (!view) {
    return (
      <main className="page">
        <h1>Room {code}</h1>
        {existence.state === "exists" && <NicknameForm onSubmit={join} error={error?.message ?? null} />}
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
      {error && <p role="alert">{error.message}</p>}
    </main>
  );
}
