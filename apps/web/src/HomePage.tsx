import { useState } from "react";
import type { CreateRoomResponse } from "@perudo/server/protocol";
import { hostKeys } from "./room/roomStorage.ts";
import { navigate } from "./router.ts";

export function HomePage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { code, hostKey } = (await res.json()) as CreateRoomResponse;
      hostKeys.save(code, hostKey);
      navigate(`/r/${code}`);
    } catch {
      setError("Couldn't create a Room. Please try again.");
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <h1>Perudo</h1>
      <p>Create a Room, share its link, and play with up to five friends.</p>
      <button onClick={createRoom} disabled={busy}>
        Create a Room
      </button>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
