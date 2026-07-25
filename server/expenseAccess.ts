import type { ExpenseListFilters } from "./db";

export type ExpenseAccessRecord = {
  createdByUserId: number;
  chargedToUserId: number | null;
};

export function canAccessExpense(
  role: string,
  userId: number,
  expense: ExpenseAccessRecord,
) {
  return role === "admin" || role === "contador" || userId === expense.createdByUserId || userId === expense.chargedToUserId;
}

export function accessibleExpenseFilters(
  role: string,
  userId: number,
  month?: string,
): ExpenseListFilters {
  return role === "admin" || role === "contador"
    ? { month }
    : { month, chargedToUserId: userId, includeGlobalShared: true };
}
