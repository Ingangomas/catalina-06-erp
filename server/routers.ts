import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import {
  addExpenseInvoice,
  createExpenseRecord,
  getExpenseOwnership,
  getInvoiceCountForExpense,
  listExpenseCategories,
  listExpenseGridStyles,
  listExpenseRecords,
  listVoidedExpenseRecords,
  listProjectUsers,
  logExpenseChange,
  ProjectRole,
  reviewExpenseRecord,
  submitExpenseRecord,
  updateExpenseRecord,
  updateProjectUserDisplayName,
  updateProjectUserRole,
  upsertExpenseGridStyle,
  voidExpenseRecord,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { storagePut } from "./storage";
import { generatePolarsReport } from "./reporting";
import { accessibleExpenseFilters, canAccessExpense, canEditExpenseStatus, canVoidExpense } from "./expenseAccess";
import {
  ALLOWED_INVOICE_MIME_TYPES,
  MAX_INVOICE_FILE_SIZE_BYTES,
} from "../shared/expenseConstants";
import { expenseDateSchema, reportingMonthSchema } from "../shared/expenseSchemas";
import { extractInvoiceExpense } from "./invoiceExtraction";

const projectRoles = ["socio_1", "socio_2", "participante", "contador", "admin"] as const;
const privilegedRoles = ["contador", "admin"] as const;
const contributorRoles = ["socio_1", "socio_2", "participante"] as const;
const expenseTypes = ["socio_1", "socio_2", "participant", "global_shared"] as const;
const approvalDecisions = ["approved", "rejected"] as const;

function userRole(role: string): ProjectRole {
  return role as ProjectRole;
}

function requireAssignedProjectRole(role: string) {
  if (!projectRoles.includes(role as (typeof projectRoles)[number])) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Tu cuenta todavía no tiene un rol del proyecto asignado.",
    });
  }
}

function requirePrivilegedRole(role: string) {
  if (!privilegedRoles.includes(role as (typeof privilegedRoles)[number])) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Esta acción es exclusiva para Contador o Administrador.",
    });
  }
}

function requireExpenseCreator(role: string) {
  if (!projectRoles.includes(role as (typeof projectRoles)[number])) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Tu cuenta no tiene permisos para registrar gastos.",
    });
  }
}

function assertExpenseTypeAllowed(role: string, expenseType: (typeof expenseTypes)[number]) {
  const ownType = role === "participante" ? "participant" : role;
  if (
    contributorRoles.includes(role as (typeof contributorRoles)[number]) &&
    expenseType !== ownType &&
    expenseType !== "global_shared"
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Solo puedes cargar gastos a tu propio nombre o como Global/Compartido.",
    });
  }
}

async function resolveChargedToUserId(
  role: string,
  currentUserId: number,
  expenseType: (typeof expenseTypes)[number],
  inputChargedToUserId?: number | null,
) {
  if (expenseType === "global_shared") {
    if (inputChargedToUserId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Un gasto Global/Compartido no debe cargarse a una persona específica.",
      });
    }
    return null;
  }

  const chargedToUserId = contributorRoles.includes(role as (typeof contributorRoles)[number])
    ? currentUserId
    : inputChargedToUserId;
  if (!chargedToUserId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Selecciona la persona responsable del gasto." });
  }
  if (
    contributorRoles.includes(role as (typeof contributorRoles)[number]) &&
    inputChargedToUserId &&
    inputChargedToUserId !== currentUserId
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No puedes cargar un gasto a nombre de otra persona." });
  }

  const chargedToUser = (await listProjectUsers()).find(user => user.id === chargedToUserId);
  const expectedRole = expenseType === "participant" ? "participante" : expenseType;
  if (!chargedToUser || chargedToUser.role !== expectedRole) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "La persona responsable debe coincidir con el tipo de gasto seleccionado.",
    });
  }
  return chargedToUserId;
}

function normalizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "evidencia";
}

const expensePayloadSchema = z.object({
  description: z.string().trim().min(3).max(1200),
  amount: z.number().positive().max(100_000_000),
  incurredOn: expenseDateSchema,
  categoryId: z.number().int().positive(),
  expenseType: z.enum(expenseTypes),
  chargedToUserId: z.number().int().positive().nullable().optional(),
  reportingMonth: reportingMonthSchema,
});

const invoicePayloadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_INVOICE_MIME_TYPES),
  fileSize: z.number().int().positive().max(MAX_INVOICE_FILE_SIZE_BYTES),
  base64: z.string().min(1),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  profile: router({
    setExpenseName: protectedProcedure
      .input(z.object({ displayName: z.string().trim().min(2).max(120) }))
      .mutation(async ({ ctx, input }) => {
        await updateProjectUserDisplayName(ctx.user.id, input.displayName);
        return { success: true };
      }),
  }),

  categories: router({
    list: protectedProcedure.query(async () => listExpenseCategories()),
  }),

  projectUsers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      requirePrivilegedRole(ctx.user.role);
      return listProjectUsers();
    }),
    assignRole: protectedProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          role: z.enum(["socio_1", "socio_2", "participante", "contador", "admin", "user"]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo el Administrador puede asignar roles." });
        }
        await updateProjectUserRole(input.userId, input.role);
        return { success: true };
      }),
  }),

  expenseGrid: router({
    styles: protectedProcedure.query(async ({ ctx }) => {
      requireAssignedProjectRole(ctx.user.role);
      return listExpenseGridStyles(ctx.user.id);
    }),
    setStyle: protectedProcedure
      .input(
        z.object({
          targetType: z.enum(["row", "column"]),
          targetKey: z.string().trim().min(1).max(64),
          backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireAssignedProjectRole(ctx.user.role);
        await upsertExpenseGridStyle({ userId: ctx.user.id, ...input });
        return { success: true };
      }),
  }),

  expenses: router({
    list: protectedProcedure
      .input(z.object({ month: reportingMonthSchema.optional() }).optional())
      .query(async ({ ctx, input }) => {
        requireAssignedProjectRole(ctx.user.role);
        return listExpenseRecords(accessibleExpenseFilters(ctx.user.role, ctx.user.id, input?.month));
      }),

    listVoided: protectedProcedure
      .input(z.object({ month: reportingMonthSchema.optional() }).optional())
      .query(async ({ ctx, input }) => {
        requirePrivilegedRole(ctx.user.role);
        return listVoidedExpenseRecords(input?.month);
      }),

    create: protectedProcedure
      .input(expensePayloadSchema.extend({ aiAssisted: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        requireAssignedProjectRole(ctx.user.role);
        requireExpenseCreator(ctx.user.role);
        assertExpenseTypeAllowed(ctx.user.role, input.expenseType);
        const chargedToUserId = await resolveChargedToUserId(
          ctx.user.role,
          ctx.user.id,
          input.expenseType,
          input.chargedToUserId,
        );
        const id = await createExpenseRecord({
          createdByUserId: ctx.user.id,
          chargedToUserId,
          categoryId: input.categoryId,
          description: input.description,
          amount: input.amount.toFixed(2),
          incurredOn: new Date(`${input.incurredOn}T12:00:00.000Z`),
          reportingMonth: input.reportingMonth,
          expenseType: input.expenseType,
          aiAssisted: input.aiAssisted,
        });
        return { id };
      }),

    update: protectedProcedure
      .input(expensePayloadSchema.extend({ expenseId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        requireAssignedProjectRole(ctx.user.role);
        requireExpenseCreator(ctx.user.role);
        const expense = await getExpenseOwnership(input.expenseId);
        if (!expense) throw new TRPCError({ code: "NOT_FOUND", message: "Gasto no encontrado." });
        if (!canAccessExpense(ctx.user.role, ctx.user.id, expense)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "No puedes editar este gasto." });
        }
        if (!canEditExpenseStatus(ctx.user.role, expense.status)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Un gasto aprobado solo puede ser editado por el Contador o el Administrador.",
          });
        }
        assertExpenseTypeAllowed(ctx.user.role, input.expenseType);
        const chargedToUserId = await resolveChargedToUserId(
          ctx.user.role,
          ctx.user.id,
          input.expenseType,
          input.chargedToUserId,
        );
        await updateExpenseRecord(input.expenseId, {
          changedByUserId: ctx.user.id,
          chargedToUserId,
          categoryId: input.categoryId,
          description: input.description,
          amount: input.amount.toFixed(2),
          incurredOn: new Date(`${input.incurredOn}T12:00:00.000Z`),
          reportingMonth: input.reportingMonth,
          expenseType: input.expenseType,
        });
        return { success: true };
      }),

    void: protectedProcedure
      .input(z.object({ expenseId: z.number().int().positive(), reason: z.string().trim().min(3).max(500) }))
      .mutation(async ({ ctx, input }) => {
        requireAssignedProjectRole(ctx.user.role);
        const expense = await getExpenseOwnership(input.expenseId);
        if (!expense) throw new TRPCError({ code: "NOT_FOUND", message: "Gasto no encontrado." });
        if (!canVoidExpense(ctx.user.role, ctx.user.id, expense)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No puedes anular este gasto en su estado actual.",
          });
        }
        await voidExpenseRecord({
          expenseId: input.expenseId,
          voidedByUserId: ctx.user.id,
          reason: input.reason,
        });
        return { success: true };
      }),

    extractInvoice: protectedProcedure
      .input(invoicePayloadSchema)
      .mutation(async ({ ctx, input }) => {
        requireAssignedProjectRole(ctx.user.role);
        requireExpenseCreator(ctx.user.role);
        const bytes = Buffer.from(input.base64, "base64");
        if (bytes.length === 0 || bytes.length > MAX_INVOICE_FILE_SIZE_BYTES || bytes.length !== input.fileSize) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "El archivo no supera la validación de tamaño." });
        }
        const categories = await listExpenseCategories();
        return extractInvoiceExpense({
          fileName: input.fileName,
          mimeType: input.mimeType,
          base64: input.base64,
          categoryLabels: categories.map(category => category.label),
        });
      }),

    submit: protectedProcedure
      .input(z.object({ expenseId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        requireAssignedProjectRole(ctx.user.role);
        const expense = await getExpenseOwnership(input.expenseId);
        if (!expense) throw new TRPCError({ code: "NOT_FOUND", message: "Gasto no encontrado." });
        if (!canAccessExpense(ctx.user.role, ctx.user.id, expense)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "No puedes enviar este gasto." });
        }
        if (expense.status !== "draft") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Solo los borradores pueden enviarse." });
        }
        const invoiceCount = await getInvoiceCountForExpense(input.expenseId);
        if (invoiceCount === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Adjunta al menos una factura o recibo antes de enviar el gasto." });
        }
        await submitExpenseRecord(input.expenseId);
        await logExpenseChange({
          expenseId: input.expenseId,
          changedByUserId: ctx.user.id,
          action: "submitted",
          details: "Gasto enviado para revisión contable.",
        });
        return { success: true };
      }),

    uploadInvoice: protectedProcedure
      .input(z.object({ expenseId: z.number().int().positive() }).merge(invoicePayloadSchema))
      .mutation(async ({ ctx, input }) => {
        requireAssignedProjectRole(ctx.user.role);
        requireExpenseCreator(ctx.user.role);
        const expense = await getExpenseOwnership(input.expenseId);
        if (!expense) throw new TRPCError({ code: "NOT_FOUND", message: "Gasto no encontrado." });
        if (!canAccessExpense(ctx.user.role, ctx.user.id, expense)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "No puedes adjuntar evidencia a este gasto." });
        }
        if (expense.status === "approved" || expense.status === "rejected") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Edita el gasto antes de cambiar su evidencia." });
        }
        const bytes = Buffer.from(input.base64, "base64");
        if (bytes.length === 0 || bytes.length > MAX_INVOICE_FILE_SIZE_BYTES || bytes.length !== input.fileSize) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "El archivo no supera la validación de tamaño." });
        }
        const safeFileName = normalizeFileName(input.fileName);
        const objectPath = `catalina-06/facturas/${expense.reportingMonth}/gasto-${expense.id}/${Date.now()}-${safeFileName}`;
        const stored = await storagePut(objectPath, bytes, input.mimeType);
        const invoiceId = await addExpenseInvoice({
          expenseId: expense.id,
          uploadedByUserId: ctx.user.id,
          originalName: input.fileName,
          storageKey: stored.key,
          fileUrl: stored.url,
          mimeType: input.mimeType,
          fileSize: bytes.length,
          archivedMonth: expense.reportingMonth,
        });
        return { id: invoiceId, url: stored.url };
      }),

    review: protectedProcedure
      .input(
        z.object({
          expenseId: z.number().int().positive(),
          decision: z.enum(approvalDecisions),
          comments: z.string().trim().max(2000).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requirePrivilegedRole(ctx.user.role);
        const expense = await getExpenseOwnership(input.expenseId);
        if (!expense) throw new TRPCError({ code: "NOT_FOUND", message: "Gasto no encontrado." });
        if (expense.status !== "submitted") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Solo los gastos enviados pueden revisarse." });
        }
        await reviewExpenseRecord({
          expenseId: input.expenseId,
          reviewedByUserId: ctx.user.id,
          decision: input.decision,
          comments: input.comments,
        });
        return { success: true };
      }),
  }),

  dashboard: router({
    analytics: protectedProcedure
      .input(z.object({ month: reportingMonthSchema }))
      .query(async ({ ctx, input }) => {
        requireAssignedProjectRole(ctx.user.role);
        const records = await listExpenseRecords(accessibleExpenseFilters(ctx.user.role, ctx.user.id));
        return generatePolarsReport({ mode: "analytics", selectedMonth: input.month, expenses: records });
      }),
  }),

  reports: router({
    monthly: protectedProcedure
      .input(z.object({ month: reportingMonthSchema }))
      .query(async ({ ctx, input }) => {
        requireAssignedProjectRole(ctx.user.role);
        const records = await listExpenseRecords(accessibleExpenseFilters(ctx.user.role, ctx.user.id));
        return generatePolarsReport({ mode: "monthly_report", selectedMonth: input.month, expenses: records });
      }),
  }),
});

export type AppRouter = typeof appRouter;
