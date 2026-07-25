import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { or } from "drizzle-orm";
import {
  expenseApprovals,
  expenseCategories,
  expenseInvoices,
  expenses,
  InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export type ProjectRole = "user" | "socio_1" | "socio_2" | "contador" | "admin";
export type ExpenseType = "socio_1" | "socio_2" | "global_shared";
export type ExpenseStatus = "draft" | "submitted" | "approved" | "rejected";

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
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
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

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }

    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

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
      email: users.email,
      role: users.role,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(asc(users.name));
}

export async function updateProjectUserRole(userId: number, role: ProjectRole) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  await db.update(users).set({ role }).where(eq(users.id, userId));
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
};

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

  return created?.id;
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
      status: expenses.status,
    })
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .limit(1);

  return result[0];
}

export async function submitExpenseRecord(expenseId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  await db
    .update(expenses)
    .set({ status: "submitted", submittedAt: new Date() })
    .where(eq(expenses.id, expenseId));
}

export async function getInvoiceCountForExpense(expenseId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ count: count() })
    .from(expenseInvoices)
    .where(eq(expenseInvoices.expenseId, expenseId));

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
    await tx
      .update(expenses)
      .set({ status: payload.decision })
      .where(eq(expenses.id, payload.expenseId));

    await tx.insert(expenseApprovals).values(payload).onDuplicateKeyUpdate({
      set: {
        reviewedByUserId: payload.reviewedByUserId,
        decision: payload.decision,
        comments: payload.comments ?? null,
        reviewedAt: new Date(),
      },
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
        ? or(
            eq(expenses.chargedToUserId, filters.chargedToUserId),
            eq(expenses.expenseType, "global_shared"),
          )
        : eq(expenses.chargedToUserId, filters.chargedToUserId),
    );
  }

  const rows = await db
    .select()
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .innerJoin(users, eq(expenses.createdByUserId, users.id))
    .leftJoin(expenseApprovals, eq(expenseApprovals.expenseId, expenses.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(expenses.incurredOn), desc(expenses.id));

  const expenseIds = rows.map(row => row.expenses.id);
  const invoiceRows = expenseIds.length
    ? await db
        .select()
        .from(expenseInvoices)
        .where(inArray(expenseInvoices.expenseId, expenseIds))
        .orderBy(desc(expenseInvoices.uploadedAt))
    : [];

  const invoicesByExpense = new Map<number, typeof invoiceRows>();
  invoiceRows.forEach(invoice => {
    const invoices = invoicesByExpense.get(invoice.expenseId) ?? [];
    invoices.push(invoice);
    invoicesByExpense.set(invoice.expenseId, invoices);
  });

  return rows.map(row => ({
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
    category: {
      id: row.expense_categories.id,
      label: row.expense_categories.label,
      color: row.expense_categories.color,
    },
    createdBy: {
      id: row.users.id,
      name: row.users.name,
      email: row.users.email,
      role: row.users.role,
    },
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
  }));
}
