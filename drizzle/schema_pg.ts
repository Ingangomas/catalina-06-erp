import { pgTable, serial, text, timestamp, decimal, integer, boolean, pgEnum } from "drizzle-orm/pg-core";

export const projectRoleEnum = pgEnum("project_role", ["admin", "socio_1", "socio_2", "participante", "contador", "user"]);
export const expenseStatusEnum = pgEnum("expense_status", ["draft", "submitted", "approved", "rejected", "voided"]);
export const expenseTypeEnum = pgEnum("expense_type", ["socio_1", "socio_2", "global"]);
export const changeActionEnum = pgEnum("change_action", ["created", "updated", "submitted", "approved", "rejected", "voided"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: text("open_id").notNull().unique(),
  name: text("name"),
  email: text("email"),
  role: projectRoleEnum("role").default("user").notNull(),
  assignedExpenseType: expenseTypeEnum("assigned_expense_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  incurredOn: timestamp("incurred_on", { withTimezone: true }).notNull(),
  reportingMonth: text("reporting_month").notNull(),
  categoryId: integer("category_id").references(() => expenseCategories.id).notNull(),
  expenseType: expenseTypeEnum("expense_type").notNull(),
  chargedToUserId: integer("charged_to_user_id").references(() => users.id),
  status: expenseStatusEnum("status").default("draft").notNull(),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const expenseInvoices = pgTable("expense_invoices", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").references(() => expenses.id, { onDelete: "cascade" }).notNull(),
  storageKey: text("storage_key").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  archivedMonth: text("archived_month").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
});

export const expenseApprovals = pgTable("expense_approvals", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").references(() => expenses.id, { onDelete: "cascade" }).notNull(),
  reviewerId: integer("reviewer_id").references(() => users.id).notNull(),
  status: expenseStatusEnum("status").notNull(),
  comments: text("comments"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const expenseChangeLogs = pgTable("expense_change_logs", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").references(() => expenses.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  action: changeActionEnum("action").notNull(),
  details: text("details").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const expenseGridStyles = pgTable("expense_grid_styles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  rowColors: text("row_colors").default("{}").notNull(),
  columnColors: text("column_colors").default("{}").notNull(),
  columnWidths: text("column_widths").default("{}").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
