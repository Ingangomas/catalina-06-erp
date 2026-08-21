import type { IncomingMessage, ServerResponse } from "node:http";
import { appRouter } from "../routers";

export default function routerProbe(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: Boolean(appRouter), stage: "trpc-router-import" }));
}
