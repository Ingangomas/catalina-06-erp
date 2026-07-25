import { describe, expect, it, vi } from "vitest";
import { executeVoidExpenseTransaction } from "./db";

describe("preservación de evidencias al anular", () => {
  it("solo cambia el estado y crea auditoría, sin borrar facturas archivadas", async () => {
    const archivedInvoices = [{
      expenseId: 88,
      storageKey: "invoices/2026-07/88/ferreteria-detallista.jpeg",
      fileUrl: "https://storage.example/invoices/2026-07/88/ferreteria-detallista.jpeg",
    }];
    const limit = vi.fn().mockResolvedValue([{ description: "Compra de block", status: "submitted" }]);
    const whereForSelect = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where: whereForSelect });
    const select = vi.fn().mockReturnValue({ from });
    const whereForUpdate = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where: whereForUpdate });
    const update = vi.fn().mockReturnValue({ set });
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const remove = vi.fn();
    const transaction = { select, update, insert, delete: remove };

    await executeVoidExpenseTransaction(transaction, {
      expenseId: 88,
      voidedByUserId: 90,
      reason: "Registro duplicado",
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      expenseId: 88,
      changedByUserId: 90,
      action: "voided",
    }));
    expect(remove).not.toHaveBeenCalled();
    expect(archivedInvoices).toEqual([{
      expenseId: 88,
      storageKey: "invoices/2026-07/88/ferreteria-detallista.jpeg",
      fileUrl: "https://storage.example/invoices/2026-07/88/ferreteria-detallista.jpeg",
    }]);
  });
});
