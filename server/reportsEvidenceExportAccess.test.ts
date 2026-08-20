import type { TrpcContext } from "./_core/context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ listExpenseRecords: vi.fn() }));
const exportMocks = vi.hoisted(() => ({ createMonthlyEvidenceExport: vi.fn() }));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...dbMocks };
});

vi.mock("./monthlyEvidenceExport", () => exportMocks);

import { appRouter } from "./routers";

function context(role: "user" | "socio_1" | "contador"): TrpcContext {
  return {
    user: { id: role === "socio_1" ? 12 : 90, openId: `${role}-evidence-export`, name: role, email: `${role}@example.com`, loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("reports.evidencePackage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.listExpenseRecords.mockResolvedValue([]);
    exportMocks.createMonthlyEvidenceExport.mockResolvedValue({ filename: "julio.zip", url: "https://example.com/julio.zip", evidenceCount: 0 });
  });

  it("bloquea la exportación para una cuenta sin rol del proyecto", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.reports.evidencePackage({ month: "2026-07" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.listExpenseRecords).not.toHaveBeenCalled();
  });

  it("restringe el paquete de un socio a sus gastos y a los globales", async () => {
    const caller = appRouter.createCaller(context("socio_1"));
    await caller.reports.evidencePackage({ month: "2026-07" });
    expect(dbMocks.listExpenseRecords).toHaveBeenCalledWith({ month: "2026-07", chargedToUserId: 12, includeGlobalShared: true });
  });

  it("permite al Contador exportar los registros del período completo", async () => {
    const caller = appRouter.createCaller(context("contador"));
    await caller.reports.evidencePackage({ month: "2026-07" });
    expect(dbMocks.listExpenseRecords).toHaveBeenCalledWith({ month: "2026-07" });
    expect(exportMocks.createMonthlyEvidenceExport).toHaveBeenCalledWith({ month: "2026-07", records: [] });
  });
});
