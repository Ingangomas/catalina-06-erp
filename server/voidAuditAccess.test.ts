import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({ listVoidedExpenseRecords: vi.fn() }));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...dbMocks };
});

import { appRouter } from "./routers";

function context(role: "socio_1" | "contador"): TrpcContext {
  return {
    user: { id: role === "contador" ? 90 : 12, openId: `${role}-audit`, name: role, email: `${role}@example.com`, loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("expenses.listVoided", () => {
  beforeEach(() => vi.clearAllMocks());

  it("restringe la auditoría de anulaciones a los roles contables", async () => {
    const caller = appRouter.createCaller(context("socio_1"));
    await expect(caller.expenses.listVoided({ month: "2026-07" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.listVoidedExpenseRecords).not.toHaveBeenCalled();
  });

  it("entrega al Contador los registros anulados del mes solicitado", async () => {
    const expected = [{ id: 88, description: "Factura duplicada", invoices: [{ id: 5 }] }];
    dbMocks.listVoidedExpenseRecords.mockResolvedValue(expected);
    const caller = appRouter.createCaller(context("contador"));
    await expect(caller.expenses.listVoided({ month: "2026-07" })).resolves.toEqual(expected);
    expect(dbMocks.listVoidedExpenseRecords).toHaveBeenCalledWith("2026-07");
  });
});
