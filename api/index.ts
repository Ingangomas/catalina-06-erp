import type { IncomingMessage, ServerResponse } from "node:http";

type ExpressHandler = (req: IncomingMessage, res: ServerResponse) => void;
let appPromise: Promise<ExpressHandler> | undefined;

async function getApp() {
  appPromise ??= import("../server/_core/app").then(({ createApp }) => createApp() as unknown as ExpressHandler);
  return appPromise;
}

// Punto de entrada para @vercel/node. La carga diferida permite devolver un
// diagnóstico controlado si una dependencia de producción no inicia.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[Vercel API] Bootstrap failed", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "API bootstrap failed", detail }));
  }
}
