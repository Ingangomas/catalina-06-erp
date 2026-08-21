import type { IncomingMessage, ServerResponse } from "node:http";
import * as db from "../server/db";

export default function dbProbe(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: Boolean(db), stage: "standard-api-db-import" }));
}
