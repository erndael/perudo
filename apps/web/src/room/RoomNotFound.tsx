import type { MouseEvent } from "react";
import { navigate } from "../router.ts";

/** Shown for a Room code that was never created or whose Room has expired. */
export function RoomNotFound({ message }: { message: string }) {
  const goHome = (event: MouseEvent) => {
    event.preventDefault();
    navigate("/");
  };

  return (
    <main className="page">
      <h1>Room not found</h1>
      <p>{message}</p>
      <p>
        <a href="/" onClick={goHome}>
          Create a new Room
        </a>
      </p>
    </main>
  );
}
