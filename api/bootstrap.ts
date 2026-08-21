import type { IncomingMessage, ServerResponse } from "node:http";

/** Diagnóstico temporal: comprueba la carga del módulo Express sin enrutar una solicitud tRPC. */
export default async function bootstrap(_req: IncomingMessage, res: ServerResponse) {
  try {
    await import("../server/_core/app");
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, stage: "express-app-import" }));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, stage: "express-app-import", detail }));
  }
}
