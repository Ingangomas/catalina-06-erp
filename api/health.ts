import type { IncomingMessage, ServerResponse } from "node:http";

/** Función mínima sin dependencias de proyecto para diagnosticar el runtime de Vercel. */
export default function health(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: true, runtime: "vercel-node", release: "api-diagnostics-v1" }));
}
