// Entry point: reads configuration from the environment and starts the server.
//   PORT  (default 3000)
import { fileURLToPath } from "node:url";
import { secureRng, systemClock } from "./deps.ts";
import { startServer } from "./server.ts";

const port = Number(process.env.PORT ?? 3000);
const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));

await startServer({ port, webRoot, rng: secureRng, clock: systemClock });
console.log(`Perudo listening on http://localhost:${port}`);
