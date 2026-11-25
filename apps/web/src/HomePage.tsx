import { useState, type FormEvent } from "react";
import type { CreateRoomResponse } from "@perudo/server/protocol";
import { hostKeys } from "./room/roomStorage.ts";
import { navigate, roomCodeFromInput } from "./router.ts";

export function HomePage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  // The Room page itself says if the Room doesn't exist (or has expired).
  const joinByCode = (event: FormEvent) => {
    event.preventDefault();
    const code = roomCodeFromInput(codeInput);
    if (!code) return setCodeError("That doesn't look like a Room code. It's the letters and digits after /r/ in the link.");
    navigate(`/r/${code}`);
  };

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

      <h2>Join a Room</h2>
      <form onSubmit={joinByCode}>
        <label>
          Room code
          <input
            value={codeInput}
            onChange={(e) => {
              setCodeInput(e.target.value);
              setCodeError(null);
            }}
            placeholder="e.g. 7PF9V2 or a Room link"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" disabled={codeInput.trim() === ""}>
          Join Room
        </button>
        {codeError && <p role="alert">{codeError}</p>}
      </form>
    </main>
  );
}
