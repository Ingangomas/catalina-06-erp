import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getExpenseOwnership: vi.fn(),
  listProjectUsers: vi.fn(),
  updateExpenseRecord: vi.fn(),
  voidExpenseRecord: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...dbMocks };
});

import { buildExpenseUpdateAuditDetails, buildExpenseVoidAuditDetails } from "./db";
import { appRouter } from "./routers";

function context(role: "socio_1" | "contador"): TrpcContext {
  return {
    user: {
      id: role === "contador" ? 90 : 12,
      openId: `${role}-test`,
      name: role,
      email: `${role}@example.com`,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const updateInput = {
  expenseId: 41,
  description: "Compra de cemento ajustada",
  amount: 2450,
  incurredOn: "2026-07-25",
  categoryId: 1,
  expenseType: "socio_1" as const,
  chargedToUserId: 12,
  reportingMonth: "2026-07",
};

describe("expenses.update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.listProjectUsers.mockResolvedValue([
      { id: 12, role: "admin", expenseOwnerType: "socio_1" },
      { id: 13, role: "admin", expenseOwnerType: "socio_2" },
    ]);
  });

  it("rechaza que un socio edite un gasto aprobado", async () => {
    dbMocks.getExpenseOwnership.mockResolvedValue({
      id: 41,
      createdByUserId: 12,
      chargedToUserId: 12,
      status: "approved",
    });

    const caller = appRouter.createCaller(context("socio_1"));

    await expect(caller.expenses.update(updateInput)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.updateExpenseRecord).not.toHaveBeenCalled();
  });

  it("permite al Contador corregir un gasto aprobado y lo devuelve a borrador", async () => {
    dbMocks.getExpenseOwnership.mockResolvedValue({
      id: 41,
      createdByUserId: 12,
      chargedToUserId: 12,
      status: "approved",
    });

    const caller = appRouter.createCaller(context("contador"));
    await expect(caller.expenses.update(updateInput)).resolves.toEqual({ success: true });
    expect(dbMocks.updateExpenseRecord).toHaveBeenCalledWith(
      41,
      expect.objectContaining({
        changedByUserId: 90,
        description: "Compra de cemento ajustada",
        amount: "2450.00",
      }),
    );
  });

  it("permite al Contador asignar un gasto al titular Johan aunque su acceso sea administrativo", async () => {
    dbMocks.getExpenseOwnership.mockResolvedValue({
      id: 42,
      createdByUserId: 13,
      chargedToUserId: 13,
      status: "submitted",
    });

    const caller = appRouter.createCaller(context("contador"));
    await expect(caller.expenses.update({ ...updateInput, expenseId: 42, expenseType: "socio_2", chargedToUserId: 13 })).resolves.toEqual({ success: true });
    expect(dbMocks.updateExpenseRecord).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ chargedToUserId: 13, expenseType: "socio_2", changedByUserId: 90 }),
    );
  });

  it("conserva antes y después en la auditoría de un cambio", () => {
    const details = JSON.parse(buildExpenseUpdateAuditDetails(
      {
        description: "Compra inicial",
        amount: "1200.00",
        incurredOn: new Date("2026-07-20T12:00:00.000Z"),
        reportingMonth: "2026-07",
        expenseType: "socio_1",
        categoryId: 1,
        chargedToUserId: 12,
        status: "submitted",
      },
      {
        changedByUserId: 90,
        chargedToUserId: 12,
        categoryId: 2,
        description: "Compra corregida",
        amount: "1400.00",
        incurredOn: new Date("2026-07-21T12:00:00.000Z"),
        reportingMonth: "2026-07",
        expenseType: "socio_1",
      },
    ));

    expect(details.previous).toMatchObject({ description: "Compra inicial", status: "submitted" });
    expect(details.next).toMatchObject({ description: "Compra corregida", amount: "1400.00", status: "draft" });
  });

  it("permite al Contador anular un gasto y conserva un motivo auditable", async () => {
    dbMocks.getExpenseOwnership.mockResolvedValue({
      id: 41,
      createdByUserId: 12,
      chargedToUserId: 12,
      status: "approved",
    });

    const caller = appRouter.createCaller(context("contador"));
    await expect(caller.expenses.void({ expenseId: 41, reason: "Factura duplicada" })).resolves.toEqual({ success: true });
    expect(dbMocks.voidExpenseRecord).toHaveBeenCalledWith({
      expenseId: 41,
      voidedByUserId: 90,
      reason: "Factura duplicada",
    });

    const details = JSON.parse(buildExpenseVoidAuditDetails({
      description: "Compra de cemento",
      previousStatus: "approved",
      reason: "Factura duplicada",
    }));
    expect(details).toMatchObject({
      description: "Compra de cemento",
      previousStatus: "approved",
      nextStatus: "voided",
      reason: "Factura duplicada",
    });
  });
});
