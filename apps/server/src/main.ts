// Entry point: reads configuration from the environment (see config.ts) and starts the server.
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.ts";
import { systemClock } from "./deps.ts";
import { startServer } from "./server.ts";

const config = loadConfig(process.env);
const webRoot = fileURLToPath(new URL("../../web/dist", import.meta.url));

await startServer({ ...config, webRoot, clock: systemClock });
console.log(`Perudo listening on http://localhost:${config.port}`);
if (config.testMode) console.log("TEST MODE: dice are seeded, not secure.");
