import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import {
  addExpenseInvoice,
  createExpenseRecord,
  getExpenseOwnership,
  getInvoiceCountForExpense,
  listExpenseCategories,
  listExpenseRecords,
  listProjectUsers,
  ProjectRole,
  reviewExpenseRecord,
  submitExpenseRecord,
  updateProjectUserRole,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { storagePut } from "./storage";
import { generatePolarsReport } from "./reporting";
import { accessibleExpenseFilters, canAccessExpense } from "./expenseAccess";
import {
  ALLOWED_INVOICE_MIME_TYPES,
  MAX_INVOICE_FILE_SIZE_BYTES,
} from "../shared/expenseConstants";
import { expenseDateSchema, reportingMonthSchema } from "../shared/expenseSchemas";

const projectRoles = ["socio_1", "socio_2", "contador", "admin"] as const;
const privilegedRoles = ["contador", "admin"] as const;
const partnerRoles = ["socio_1", "socio_2"] as const;
const expenseTypes = ["socio_1", "socio_2", "global_shared"] as const;
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

function requirePartnerOrAdmin(role: string) {
  if (
    !partnerRoles.includes(role as (typeof partnerRoles)[number]) &&
    role !== "admin"
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Solo los socios pueden registrar gastos.",
    });
  }
}

function assertExpenseTypeAllowed(role: string, expenseType: (typeof expenseTypes)[number]) {
  if (role === "socio_1" && expenseType === "socio_2") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Socio 1 no puede registrar un gasto a nombre de Socio 2.",
    });
  }
  if (role === "socio_2" && expenseType === "socio_1") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Socio 2 no puede registrar un gasto a nombre de Socio 1.",
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
      throw new TRPCError({ code: "BAD_REQUEST", message: "Un gasto Global/Compartido no debe cargarse a un socio específico." });
    }
    return null;
  }

  const chargedToUserId = partnerRoles.includes(role as (typeof partnerRoles)[number])
    ? currentUserId
    : inputChargedToUserId;

  if (!chargedToUserId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Selecciona el socio responsable del gasto." });
  }

  if (partnerRoles.includes(role as (typeof partnerRoles)[number]) && inputChargedToUserId && inputChargedToUserId !== currentUserId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No puedes cargar un gasto a nombre de otro socio." });
  }

  const chargedToUser = (await listProjectUsers()).find(user => user.id === chargedToUserId);
  if (!chargedToUser || chargedToUser.role !== expenseType) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "El socio responsable debe coincidir con el tipo de gasto seleccionado.",
    });
  }
  return chargedToUserId;
}

function normalizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "evidencia";
}

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
          role: z.enum(["socio_1", "socio_2", "contador", "admin", "user"]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Solo el Administrador puede asignar roles.",
          });
        }
        await updateProjectUserRole(input.userId, input.role);
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

    create: protectedProcedure
      .input(
        z.object({
          description: z.string().trim().min(3).max(1200),
          amount: z.number().positive().max(100_000_000),
          incurredOn: expenseDateSchema,
          categoryId: z.number().int().positive(),
          expenseType: z.enum(expenseTypes),
          chargedToUserId: z.number().int().positive().nullable().optional(),
          reportingMonth: reportingMonthSchema,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireAssignedProjectRole(ctx.user.role);
        requirePartnerOrAdmin(ctx.user.role);
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
        });
        return { id };
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
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Adjunta al menos una factura o recibo antes de enviar el gasto.",
          });
        }
        await submitExpenseRecord(input.expenseId);
        return { success: true };
      }),

    uploadInvoice: protectedProcedure
      .input(
        z.object({
          expenseId: z.number().int().positive(),
          fileName: z.string().trim().min(1).max(255),
          mimeType: z.enum(ALLOWED_INVOICE_MIME_TYPES),
          fileSize: z.number().int().positive().max(MAX_INVOICE_FILE_SIZE_BYTES),
          base64: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        requireAssignedProjectRole(ctx.user.role);
        requirePartnerOrAdmin(ctx.user.role);
        const expense = await getExpenseOwnership(input.expenseId);
        if (!expense) throw new TRPCError({ code: "NOT_FOUND", message: "Gasto no encontrado." });
        if (!canAccessExpense(ctx.user.role, ctx.user.id, expense)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "No puedes adjuntar evidencia a este gasto." });
        }
        if (expense.status === "approved" || expense.status === "rejected") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No se pueden modificar gastos ya revisados.",
          });
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
