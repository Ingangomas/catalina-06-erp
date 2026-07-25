import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { accessibleExpenseFilters, canAccessExpense, canEditExpenseStatus, canVoidExpense } from "./expenseAccess";
import { reportingMonthSchema } from "../shared/expenseSchemas";

function createPartnerContext(): TrpcContext {
  return {
    user: {
      id: 12,
      openId: "socio-uno-test",
      name: "Socio Uno",
      email: "socio1@example.com",
      loginMethod: "manus",
      role: "socio_1",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("restricciones de acceso a gastos", () => {
  it("impide que un socio consulte la administración de usuarios", async () => {
    const caller = appRouter.createCaller(createPartnerContext());

    await expect(caller.projectUsers.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("impide que Socio 1 cargue un gasto a nombre de Socio 2", async () => {
    const caller = appRouter.createCaller(createPartnerContext());

    await expect(
      caller.expenses.create({
        description: "Compra de materiales para la obra",
        amount: 1500,
        incurredOn: "2026-07-18",
        categoryId: 1,
        expenseType: "socio_2",
        reportingMonth: "2026-07",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("asigna a un socio los gastos creados por Administración a su nombre", () => {
    const filters = accessibleExpenseFilters("socio_1", 12, "2026-07");
    expect(filters).toEqual({
      month: "2026-07",
      chargedToUserId: 12,
      includeGlobalShared: true,
    });
    expect(
      canAccessExpense("socio_1", 12, {
        createdByUserId: 1,
        chargedToUserId: 12,
      }),
    ).toBe(true);
  });

  it("acepta únicamente meses válidos en formato YYYY-MM", () => {
    expect(reportingMonthSchema.safeParse("2026-07").success).toBe(true);
    expect(reportingMonthSchema.safeParse("2026-13").success).toBe(false);
    expect(reportingMonthSchema.safeParse("julio-2026").success).toBe(false);
  });

  it("restringe la edición de un participante a sus propios gastos y permite la gestión contable", () => {
    const filters = accessibleExpenseFilters("participante", 24, "2026-07");
    expect(filters).toEqual({
      month: "2026-07",
      chargedToUserId: 24,
      includeGlobalShared: true,
    });
    expect(canAccessExpense("participante", 24, { createdByUserId: 3, chargedToUserId: 24 })).toBe(true);
    expect(canAccessExpense("participante", 24, { createdByUserId: 3, chargedToUserId: 8 })).toBe(false);
    expect(canAccessExpense("contador", 99, { createdByUserId: 3, chargedToUserId: 8 })).toBe(true);
  });

  it("protege los gastos aprobados de ediciones no contables", () => {
    expect(canEditExpenseStatus("socio_1", "approved")).toBe(false);
    expect(canEditExpenseStatus("socio_1", "submitted")).toBe(true);
    expect(canEditExpenseStatus("participante", "rejected")).toBe(true);
    expect(canEditExpenseStatus("contador", "approved")).toBe(true);
    expect(canEditExpenseStatus("admin", "approved")).toBe(true);
  });

  it("permite anular según el rol, relación con el gasto y estado", () => {
    const ownDraft = { createdByUserId: 12, chargedToUserId: 12, status: "draft" };
    const ownApproved = { createdByUserId: 12, chargedToUserId: 12, status: "approved" };
    const foreignDraft = { createdByUserId: 3, chargedToUserId: 8, status: "draft" };

    expect(canVoidExpense("socio_1", 12, ownDraft)).toBe(true);
    expect(canVoidExpense("socio_1", 12, ownApproved)).toBe(false);
    expect(canVoidExpense("socio_1", 12, foreignDraft)).toBe(false);
    expect(canVoidExpense("contador", 90, ownApproved)).toBe(true);
    expect(canVoidExpense("admin", 1, { ...ownDraft, status: "voided" })).toBe(false);
  });
});
