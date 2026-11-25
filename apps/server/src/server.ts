// One Node process: serves the built web app, a tiny HTTP API, and the WebSocket,
// all on the same origin.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { WebSocketServer } from "ws";
import type { Clock, Rng } from "./deps.ts";
import type { CreateRoomResponse } from "./protocol.ts";
import { createRegistry } from "./registry.ts";
import { attachTransport } from "./transport.ts";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
};

export interface ServerOptions {
  port: number;
  /** Directory holding the built web app (index.html + assets). */
  webRoot: string;
  rng: Rng;
  clock: Clock;
}

export function startServer(opts: ServerOptions): Promise<Server> {
  const registry = createRegistry({ rng: opts.rng, clock: opts.clock });
  const webRoot = resolve(opts.webRoot);

  const serveFile = async (res: ServerResponse, path: string) => {
    res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
    createReadStream(path).pipe(res);
  };

  const serveStatic = async (req: IncomingMessage, res: ServerResponse) => {
    const urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    const candidate = normalize(join(webRoot, urlPath));
    if (candidate.startsWith(webRoot + sep)) {
      const info = await stat(candidate).catch(() => null);
      if (info?.isFile()) return serveFile(res, candidate);
    }
    // SPA fallback: client-side routes like /r/<code> get index.html.
    if (extname(urlPath) === "") return serveFile(res, join(webRoot, "index.html"));
    res.writeHead(404).end("Not found");
  };

  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (req.method === "GET" && path === "/healthz") return void res.writeHead(200).end("ok");
    if (req.method === "POST" && path === "/api/rooms") {
      const body: CreateRoomResponse = { code: registry.create().code };
      return void res.writeHead(201, { "content-type": "application/json" }).end(JSON.stringify(body));
    }
    if (req.method === "GET" || req.method === "HEAD") {
      return void serveStatic(req, res).catch(() => res.writeHead(500).end());
    }
    res.writeHead(405).end();
  });

  attachTransport(new WebSocketServer({ server, path: "/ws" }), registry);

  return new Promise((ok) => server.listen(opts.port, () => ok(server)));
}
