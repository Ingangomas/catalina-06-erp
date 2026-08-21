import type { IncomingMessage, ServerResponse } from "node:http";
import { systemRouter } from "../_core/systemRouter";
export default function systemProbe(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: Boolean(systemRouter), stage: "system-router-import" }));
}
