// Asks the server whether a Room code exists before offering to join it,
// so an unknown or expired link shows a message instead of a nickname form.
import { useEffect, useState } from "react";
import type { WireError } from "@perudo/server/protocol";

export type RoomExistence = { state: "checking" } | { state: "exists" } | { state: "missing"; message: string };

export function useRoomExists(code: string): RoomExistence {
  const [existence, setExistence] = useState<RoomExistence>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;
    setExistence({ state: "checking" });
    fetch(`/api/rooms/${encodeURIComponent(code)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          const error = (await res.json()) as WireError;
          if (!cancelled) setExistence({ state: "missing", message: error.message });
        } else {
          // Anything else (including network trouble) falls through to joining, which reports its own errors.
          setExistence({ state: "exists" });
        }
      })
      .catch(() => !cancelled && setExistence({ state: "exists" }));
    return () => {
      cancelled = true;
    };
  }, [code]);

  return existence;
}
