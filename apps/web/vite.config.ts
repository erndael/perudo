import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In dev, Vite serves the app and proxies the API and WebSocket to the Node server
// (`pnpm --filter @perudo/server dev`, default port 3000). In production the Node
// server serves the built app itself, on the same origin.
const serverPort = process.env.PORT ?? "3000";

export default defineConfig({
  plugins: [react()],
  // The lazily loaded 3D chunk (three.js + rapier, whose WASM is inlined as base64) is ~3 MB by design.
  build: { chunkSizeWarningLimit: 4000 },
  server: {
    proxy: {
      "/api": `http://localhost:${serverPort}`,
      "/ws": { target: `ws://localhost:${serverPort}`, ws: true },
    },
  },
});
