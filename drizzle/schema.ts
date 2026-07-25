import {
  date,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "socio_1", "socio_2", "contador", "admin"])
    .default("user")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const expenseCategories = mysqlTable(
  "expense_categories",
  {
    id: int("id").autoincrement().primaryKey(),
    label: varchar("label", { length: 80 }).notNull(),
    color: varchar("color", { length: 16 }).notNull(),
    sortOrder: int("sortOrder").notNull(),
    isActive: mysqlEnum("isActive", ["yes", "no"]).default("yes").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("expense_categories_label_unique").on(table.label)],
);

export const expenses = mysqlTable(
  "expenses",
  {
    id: int("id").autoincrement().primaryKey(),
    createdByUserId: int("createdByUserId")
      .notNull()
      .references(() => users.id),
    chargedToUserId: int("chargedToUserId").references(() => users.id),
    categoryId: int("categoryId")
      .notNull()
      .references(() => expenseCategories.id),
    description: text("description").notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("DOP").notNull(),
    incurredOn: date("incurredOn").notNull(),
    reportingMonth: varchar("reportingMonth", { length: 7 }).notNull(),
    expenseType: mysqlEnum("expenseType", ["socio_1", "socio_2", "global_shared"])
      .notNull(),
    status: mysqlEnum("status", ["draft", "submitted", "approved", "rejected"])
      .default("draft")
      .notNull(),
    submittedAt: timestamp("submittedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("expenses_reporting_month_idx").on(table.reportingMonth),
    index("expenses_creator_idx").on(table.createdByUserId),
    index("expenses_charged_to_idx").on(table.chargedToUserId),
    index("expenses_status_idx").on(table.status),
    index("expenses_type_idx").on(table.expenseType),
  ],
);

export const expenseInvoices = mysqlTable(
  "expense_invoices",
  {
    id: int("id").autoincrement().primaryKey(),
    expenseId: int("expenseId")
      .notNull()
      .references(() => expenses.id),
    uploadedByUserId: int("uploadedByUserId")
      .notNull()
      .references(() => users.id),
    originalName: varchar("originalName", { length: 255 }).notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    fileUrl: varchar("fileUrl", { length: 700 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    fileSize: int("fileSize").notNull(),
    archivedMonth: varchar("archivedMonth", { length: 7 }).notNull(),
    uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  },
  table => [
    index("expense_invoices_expense_idx").on(table.expenseId),
    index("expense_invoices_month_idx").on(table.archivedMonth),
  ],
);

export const expenseApprovals = mysqlTable(
  "expense_approvals",
  {
    id: int("id").autoincrement().primaryKey(),
    expenseId: int("expenseId")
      .notNull()
      .references(() => expenses.id),
    reviewedByUserId: int("reviewedByUserId")
      .notNull()
      .references(() => users.id),
    decision: mysqlEnum("decision", ["approved", "rejected"]).notNull(),
    comments: text("comments"),
    reviewedAt: timestamp("reviewedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("expense_approvals_expense_unique").on(table.expenseId)],
);

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = typeof expenseCategories.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;
export type ExpenseInvoice = typeof expenseInvoices.$inferSelect;
export type InsertExpenseInvoice = typeof expenseInvoices.$inferInsert;
export type ExpenseApproval = typeof expenseApprovals.$inferSelect;
export type InsertExpenseApproval = typeof expenseApprovals.$inferInsert;
