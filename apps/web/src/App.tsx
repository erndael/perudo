import { HomePage } from "./HomePage.tsx";
import { RoomPage } from "./room/RoomPage.tsx";
import { roomCodeFromPath, usePathname } from "./router.ts";

export function App() {
  const code = roomCodeFromPath(usePathname());
  return code ? <RoomPage key={code} code={code} /> : <HomePage />;
}
