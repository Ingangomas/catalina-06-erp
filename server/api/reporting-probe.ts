import type { IncomingMessage, ServerResponse } from "node:http";
import * as reporting from "../reporting";
export default function reportingProbe(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: Boolean(reporting), stage: "reporting-import" }));
}
