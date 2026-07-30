import { and, asc, count, desc, eq, inArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  expenseApprovals,
  expenseCategories,
  expenseChangeLogs,
  expenseGridStyles,
  expenseInvoices,
  expenses,
  InsertUser,
  projectIdentityProfiles,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { normalizeAuthorizedEmail } from "./identityProfiles";

let _db: ReturnType<typeof drizzle> | null = null;

export type ProjectRole = "user" | "socio_1" | "socio_2" | "participante" | "contador" | "admin";
export type ExpenseOwnerType = "socio_1" | "socio_2" | "participante";
export type ExpenseType = "socio_1" | "socio_2" | "participant" | "global_shared";
export type ExpenseStatus = "draft" | "submitted" | "approved" | "rejected" | "voided";
export type ExpenseChangeAction = "created" | "updated" | "ai_extracted" | "submitted" | "reviewed" | "voided";

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const normalizedEmail = user.email ? normalizeAuthorizedEmail(user.email) : null;
    const profile = normalizedEmail
      ? (await db.select().from(projectIdentityProfiles).where(eq(projectIdentityProfiles.email, normalizedEmail)).limit(1))[0]
      : undefined;
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;

    textFields.forEach(field => {
      const value = user[field];
      if (value !== undefined) {
        values[field] = value ?? null;
        updateSet[field] = value ?? null;
      }
    });
    if (normalizedEmail) {
      values.email = normalizedEmail;
      updateSet.email = normalizedEmail;
    }
    if (profile) {
      values.displayName = profile.displayName;
      updateSet.displayName = profile.displayName;
      values.role = profile.role;
      updateSet.role = profile.role;
      values.expenseOwnerType = profile.expenseOwnerType;
      updateSet.expenseOwnerType = profile.expenseOwnerType;
    }
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (!profile && user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    const matchingPreassignedUser = profile && normalizedEmail
      ? (await db.select({ id: users.id, openId: users.openId }).from(users).where(eq(users.email, normalizedEmail)).limit(1))[0]
      : undefined;
    if (matchingPreassignedUser && matchingPreassignedUser.openId !== user.openId) {
      await db.update(users).set(values).where(eq(users.id, matchingPreassignedUser.id));
      return;
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listProjectUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      email: users.email,
      loginMethod: users.loginMethod,
      role: users.role,
      expenseOwnerType: users.expenseOwnerType,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(asc(users.displayName), asc(users.name));
}

export async function updateProjectUserRole(userId: number, role: ProjectRole) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function updateProjectUserDisplayName(userId: number, displayName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(users).set({ displayName }).where(eq(users.id, userId));
}

export async function listExpenseCategories() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(expenseCategories)
    .where(eq(expenseCategories.isActive, "yes"))
    .orderBy(asc(expenseCategories.sortOrder));
}

export type CreateExpensePayload = {
  createdByUserId: number;
  chargedToUserId: number | null;
  categoryId: number;
  description: string;
  amount: string;
  incurredOn: Date;
  reportingMonth: string;
  expenseType: ExpenseType;
  aiAssisted?: boolean;
};

export type UpdateExpensePayload = Omit<CreateExpensePayload, "createdByUserId" | "aiAssisted"> & {
  changedByUserId: number;
};

export type ExpenseUpdateAuditSnapshot = {
  description: string;
  amount: string;
  incurredOn: Date;
  reportingMonth: string;
  expenseType: ExpenseType;
  categoryId: number;
  chargedToUserId: number | null;
  status: ExpenseStatus;
};

export function buildExpenseUpdateAuditDetails(previous: ExpenseUpdateAuditSnapshot, payload: UpdateExpensePayload) {
  return JSON.stringify({
    message: "Gasto editado; el estado volvió a borrador para una nueva revisión.",
    previous: {
      description: previous.description,
      amount: previous.amount,
      incurredOn: previous.incurredOn.toISOString().slice(0, 10),
      reportingMonth: previous.reportingMonth,
      expenseType: previous.expenseType,
      categoryId: previous.categoryId,
      chargedToUserId: previous.chargedToUserId,
      status: previous.status,
    },
    next: {
      description: payload.description,
      amount: payload.amount,
      incurredOn: payload.incurredOn.toISOString().slice(0, 10),
      reportingMonth: payload.reportingMonth,
      expenseType: payload.expenseType,
      categoryId: payload.categoryId,
      chargedToUserId: payload.chargedToUserId,
      status: "draft",
    },
  });
}

export async function createExpenseRecord(payload: CreateExpensePayload) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [created] = await db
    .insert(expenses)
    .values({
      createdByUserId: payload.createdByUserId,
      chargedToUserId: payload.chargedToUserId,
      categoryId: payload.categoryId,
      description: payload.description,
      amount: payload.amount,
      incurredOn: payload.incurredOn,
      reportingMonth: payload.reportingMonth,
      expenseType: payload.expenseType,
      status: "draft",
    })
    .$returningId();

  if (created?.id) {
    await db.insert(expenseChangeLogs).values({
      expenseId: created.id,
      changedByUserId: payload.createdByUserId,
      action: payload.aiAssisted ? "ai_extracted" : "created",
      details: payload.aiAssisted ? "Registro creado tras revisión de datos sugeridos por IA." : "Registro de gasto creado.",
    });
  }
  return created?.id;
}

export async function updateExpenseRecord(expenseId: number, payload: UpdateExpensePayload) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.transaction(async tx => {
    const [previous] = await tx
      .select({
        description: expenses.description,
        amount: expenses.amount,
        incurredOn: expenses.incurredOn,
        reportingMonth: expenses.reportingMonth,
        expenseType: expenses.expenseType,
        categoryId: expenses.categoryId,
        chargedToUserId: expenses.chargedToUserId,
        status: expenses.status,
      })
      .from(expenses)
      .where(eq(expenses.id, expenseId))
      .limit(1);
    if (!previous) throw new Error("Expense not found");
    await tx
      .update(expenses)
      .set({
        chargedToUserId: payload.chargedToUserId,
        categoryId: payload.categoryId,
        description: payload.description,
        amount: payload.amount,
        incurredOn: payload.incurredOn,
        reportingMonth: payload.reportingMonth,
        expenseType: payload.expenseType,
        status: "draft",
        submittedAt: null,
      })
      .where(eq(expenses.id, expenseId));
    await tx.delete(expenseApprovals).where(eq(expenseApprovals.expenseId, expenseId));
    await tx.insert(expenseChangeLogs).values({
      expenseId,
      changedByUserId: payload.changedByUserId,
      action: "updated",
      details: buildExpenseUpdateAuditDetails(previous, payload),
    });
  });
}

export type VoidExpensePayload = {
  expenseId: number;
  voidedByUserId: number;
  reason: string;
};

export function buildExpenseVoidAuditDetails(input: {
  description: string;
  previousStatus: ExpenseStatus;
  reason: string;
}) {
  return JSON.stringify({
    message: "Gasto anulado de forma segura; se conserva su evidencia y trazabilidad.",
    description: input.description,
    previousStatus: input.previousStatus,
    nextStatus: "voided",
    reason: input.reason,
  });
}

export async function executeVoidExpenseTransaction(tx: any, payload: VoidExpensePayload) {
  const [previous] = await tx
    .select({ description: expenses.description, status: expenses.status })
    .from(expenses)
    .where(eq(expenses.id, payload.expenseId))
    .limit(1);
  if (!previous) throw new Error("Expense not found");
  if (previous.status === "voided") throw new Error("Expense already voided");

  await tx
    .update(expenses)
    .set({ status: "voided", submittedAt: null })
    .where(eq(expenses.id, payload.expenseId));
  await tx.insert(expenseChangeLogs).values({
    expenseId: payload.expenseId,
    changedByUserId: payload.voidedByUserId,
    action: "voided",
    details: buildExpenseVoidAuditDetails({
      description: previous.description,
      previousStatus: previous.status,
      reason: payload.reason,
    }),
  });
}

export async function voidExpenseRecord(payload: VoidExpensePayload) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.transaction(async tx => executeVoidExpenseTransaction(tx, payload));
}

export async function getExpenseOwnership(expenseId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({
      id: expenses.id,
      createdByUserId: expenses.createdByUserId,
      chargedToUserId: expenses.chargedToUserId,
      reportingMonth: expenses.reportingMonth,
      expenseType: expenses.expenseType,
      status: expenses.status,
    })
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .limit(1);
  return result[0];
}

export async function logExpenseChange(input: {
  expenseId: number;
  changedByUserId: number;
  action: ExpenseChangeAction;
  details: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(expenseChangeLogs).values(input);
}

export async function submitExpenseRecord(expenseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(expenses).set({ status: "submitted", submittedAt: new Date() }).where(eq(expenses.id, expenseId));
}

export async function getInvoiceCountForExpense(expenseId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: count() }).from(expenseInvoices).where(eq(expenseInvoices.expenseId, expenseId));
  return Number(result[0]?.count ?? 0);
}

export type AddInvoicePayload = {
  expenseId: number;
  uploadedByUserId: number;
  originalName: string;
  storageKey: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  archivedMonth: string;
};

export async function addExpenseInvoice(payload: AddInvoicePayload) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [created] = await db.insert(expenseInvoices).values(payload).$returningId();
  return created?.id;
}

export type ReviewExpensePayload = {
  expenseId: number;
  reviewedByUserId: number;
  decision: "approved" | "rejected";
  comments?: string | null;
};

export async function reviewExpenseRecord(payload: ReviewExpensePayload) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.transaction(async tx => {
    await tx.update(expenses).set({ status: payload.decision }).where(eq(expenses.id, payload.expenseId));
    await tx.insert(expenseApprovals).values(payload).onDuplicateKeyUpdate({
      set: {
        reviewedByUserId: payload.reviewedByUserId,
        decision: payload.decision,
        comments: payload.comments ?? null,
        reviewedAt: new Date(),
      },
    });
    await tx.insert(expenseChangeLogs).values({
      expenseId: payload.expenseId,
      changedByUserId: payload.reviewedByUserId,
      action: "reviewed",
      details: payload.decision === "approved" ? "Gasto aprobado." : "Gasto rechazado.",
    });
  });
}

export type ExpenseListFilters = {
  month?: string;
  chargedToUserId?: number;
  includeGlobalShared?: boolean;
};

export async function listExpenseRecords(filters: ExpenseListFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.month) conditions.push(eq(expenses.reportingMonth, filters.month));
  if (filters.chargedToUserId) {
    conditions.push(
      filters.includeGlobalShared
        ? or(eq(expenses.chargedToUserId, filters.chargedToUserId), eq(expenses.expenseType, "global_shared"))
        : eq(expenses.chargedToUserId, filters.chargedToUserId),
    );
  }

  const rows = (await db
    .select()
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .innerJoin(users, eq(expenses.createdByUserId, users.id))
    .leftJoin(expenseApprovals, eq(expenseApprovals.expenseId, expenses.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(expenses.incurredOn), desc(expenses.id)))
    .filter(row => row.expenses.status !== "voided");

  const [invoiceRows, memberRows] = await Promise.all([
    rows.length
      ? db.select().from(expenseInvoices).where(inArray(expenseInvoices.expenseId, rows.map(row => row.expenses.id))).orderBy(desc(expenseInvoices.uploadedAt))
      : Promise.resolve([]),
    db.select({ id: users.id, name: users.name, displayName: users.displayName, email: users.email, role: users.role, expenseOwnerType: users.expenseOwnerType }).from(users),
  ]);
  const invoicesByExpense = new Map<number, typeof invoiceRows>();
  invoiceRows.forEach(invoice => {
    const invoiceList = invoicesByExpense.get(invoice.expenseId) ?? [];
    invoiceList.push(invoice);
    invoicesByExpense.set(invoice.expenseId, invoiceList);
  });
  const membersById = new Map(memberRows.map(member => [member.id, member]));

  return rows.map(row => {
    const chargedTo = row.expenses.chargedToUserId ? membersById.get(row.expenses.chargedToUserId) ?? null : null;
    return {
      id: row.expenses.id,
      description: row.expenses.description,
      amount: Number(row.expenses.amount),
      currency: row.expenses.currency,
      incurredOn: row.expenses.incurredOn,
      reportingMonth: row.expenses.reportingMonth,
      expenseType: row.expenses.expenseType,
      status: row.expenses.status,
      submittedAt: row.expenses.submittedAt,
      createdAt: row.expenses.createdAt,
      updatedAt: row.expenses.updatedAt,
      createdByUserId: row.expenses.createdByUserId,
      chargedToUserId: row.expenses.chargedToUserId,
      category: { id: row.expense_categories.id, label: row.expense_categories.label, color: row.expense_categories.color },
      createdBy: {
        id: row.users.id,
        name: row.users.displayName || row.users.name,
        email: row.users.email,
        role: row.users.role,
      },
      chargedTo: chargedTo
        ? { id: chargedTo.id, name: chargedTo.displayName || chargedTo.name, email: chargedTo.email, role: chargedTo.role }
        : null,
      approval: row.expense_approvals
        ? {
            id: row.expense_approvals.id,
            decision: row.expense_approvals.decision,
            comments: row.expense_approvals.comments,
            reviewedAt: row.expense_approvals.reviewedAt,
            reviewedByUserId: row.expense_approvals.reviewedByUserId,
          }
        : null,
      invoices: invoicesByExpense.get(row.expenses.id) ?? [],
    };
  });
}

function parseVoidAuditDetails(details: string | null) {
  try {
    const parsed = JSON.parse(details ?? "{}") as { reason?: unknown; previousStatus?: unknown };
    return {
      reason: typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason : "Motivo no registrado",
      previousStatus: typeof parsed.previousStatus === "string" ? parsed.previousStatus : "Sin estado registrado",
    };
  } catch {
    return { reason: "Motivo no registrado", previousStatus: "Sin estado registrado" };
  }
}

export async function listVoidedExpenseRecords(month?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(expenses.status, "voided")];
  if (month) conditions.push(eq(expenses.reportingMonth, month));

  const rows = await db
    .select()
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .innerJoin(users, eq(expenses.createdByUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(expenses.updatedAt), desc(expenses.id));
  const expenseIds = rows.map(row => row.expenses.id);
  const [invoiceRows, voidLogRows, memberRows] = await Promise.all([
    expenseIds.length
      ? db.select().from(expenseInvoices).where(inArray(expenseInvoices.expenseId, expenseIds)).orderBy(desc(expenseInvoices.uploadedAt))
      : Promise.resolve([]),
    expenseIds.length
      ? db
          .select({
            expenseId: expenseChangeLogs.expenseId,
            changedByUserId: expenseChangeLogs.changedByUserId,
            details: expenseChangeLogs.details,
            createdAt: expenseChangeLogs.createdAt,
          })
          .from(expenseChangeLogs)
          .where(and(inArray(expenseChangeLogs.expenseId, expenseIds), eq(expenseChangeLogs.action, "voided")))
          .orderBy(desc(expenseChangeLogs.createdAt))
      : Promise.resolve([]),
    db.select({ id: users.id, name: users.name, displayName: users.displayName, email: users.email }).from(users),
  ]);
  const invoicesByExpense = new Map<number, typeof invoiceRows>();
  invoiceRows.forEach(invoice => {
    const invoiceList = invoicesByExpense.get(invoice.expenseId) ?? [];
    invoiceList.push(invoice);
    invoicesByExpense.set(invoice.expenseId, invoiceList);
  });
  const voidLogByExpense = new Map<number, (typeof voidLogRows)[number]>();
  voidLogRows.forEach(log => {
    if (!voidLogByExpense.has(log.expenseId)) voidLogByExpense.set(log.expenseId, log);
  });
  const membersById = new Map(memberRows.map(member => [member.id, member]));

  return rows.map(row => {
    const voidLog = voidLogByExpense.get(row.expenses.id);
    const audit = parseVoidAuditDetails(voidLog?.details ?? null);
    const voidedBy = voidLog ? membersById.get(voidLog.changedByUserId) ?? null : null;
    return {
      id: row.expenses.id,
      description: row.expenses.description,
      amount: Number(row.expenses.amount),
      incurredOn: row.expenses.incurredOn,
      reportingMonth: row.expenses.reportingMonth,
      category: { id: row.expense_categories.id, label: row.expense_categories.label, color: row.expense_categories.color },
      createdBy: { id: row.users.id, name: row.users.displayName || row.users.name, email: row.users.email },
      previousStatus: audit.previousStatus,
      voidReason: audit.reason,
      voidedAt: voidLog?.createdAt ?? row.expenses.updatedAt,
      voidedBy: voidedBy ? { id: voidedBy.id, name: voidedBy.displayName || voidedBy.name, email: voidedBy.email } : null,
      invoices: invoicesByExpense.get(row.expenses.id) ?? [],
    };
  });
}

export async function listExpenseGridStyles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(expenseGridStyles).where(eq(expenseGridStyles.userId, userId));
}

export async function upsertExpenseGridStyle(input: {
  userId: number;
  targetType: "row" | "column";
  targetKey: string;
  backgroundColor: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(expenseGridStyles).values(input).onDuplicateKeyUpdate({
    set: { backgroundColor: input.backgroundColor },
  });
}
