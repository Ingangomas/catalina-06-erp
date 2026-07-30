export type ExpenseOwnerType = "socio_1" | "socio_2" | "participante";
export type AssignableExpenseType = "socio_1" | "socio_2" | "participant" | "global_shared";

export function normalizeAuthorizedEmail(email: string) {
  return email.trim().toLowerCase();
}

export function pendingOpenIdForEmail(email: string) {
  return `pending:${normalizeAuthorizedEmail(email)}`;
}

export function expectedExpenseOwnerType(expenseType: AssignableExpenseType): ExpenseOwnerType | null {
  if (expenseType === "global_shared") return null;
  return expenseType === "participant" ? "participante" : expenseType;
}
