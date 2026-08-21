import type { IncomingMessage, ServerResponse } from "node:http";
import * as invoice from "../invoiceExtraction";
export default function invoiceProbe(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: Boolean(invoice), stage: "invoice-import" }));
}
