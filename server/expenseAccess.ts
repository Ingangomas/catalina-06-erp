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

export function canEditExpenseStatus(role: string, status: string) {
  if (role === "admin" || role === "contador") return true;
  return status === "draft" || status === "submitted" || status === "rejected";
}

export function canVoidExpense(
  role: string,
  userId: number,
  expense: ExpenseAccessRecord & { status: string },
) {
  if (expense.status === "voided") return false;
  if (role === "admin" || role === "contador") return true;
  const isRelatedToExpense = userId === expense.createdByUserId || userId === expense.chargedToUserId;
  return isRelatedToExpense && (expense.status === "draft" || expense.status === "submitted" || expense.status === "rejected");
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
