import { generatePolarsReport } from "./reporting";
import { storageGetSignedUrl, storagePut } from "./storage";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);


type MonthlyInvoice = {
  id: number;
  originalName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  archivedMonth: string;
  uploadedAt: Date;
};

export type MonthlyEvidenceRecord = {
  id: number;
  description: string;
  amount: number;
  incurredOn: string | Date;
  reportingMonth: string;
  expenseType: string;
  status: string;
  category: { label: string };
  createdBy: { name: string | null };
  invoices: MonthlyInvoice[];
};

export type MonthlyEvidenceInventoryItem = {
  invoiceId: number;
  archivePath: string;
  expenseId: number;
  expenseDescription: string;
  incurredOn: string;
  category: string;
  originalName: string;
  mimeType: string;
  size: number;
};

const MONTH_LABELS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function safeArchiveSegment(value: string, fallback: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function asDateLabel(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "sin-fecha" : date.toISOString().slice(0, 10);
}

export function monthlyFolderName(month: string) {
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const year = month.slice(0, 4);
  return `${MONTH_LABELS[monthIndex] ?? "periodo"}-${year}`;
}

export function monthlyExportFileName(month: string) {
  return `catalina-06-reporte-evidencias-${month}.zip`;
}

export function buildMonthlyEvidenceInventory(records: MonthlyEvidenceRecord[], month: string): MonthlyEvidenceInventoryItem[] {
  const folder = monthlyFolderName(month);
  return records.flatMap(record =>
    record.invoices.map(invoice => {
      const date = asDateLabel(record.incurredOn);
      const description = safeArchiveSegment(record.description, "gasto").slice(0, 72);
      const originalName = safeArchiveSegment(invoice.originalName, "evidencia");
      return {
        invoiceId: invoice.id,
        archivePath: `evidencias/${folder}/${date}__gasto-${record.id}__${description}__factura-${invoice.id}__${originalName}`,
        expenseId: record.id,
        expenseDescription: record.description,
        incurredOn: date,
        category: record.category.label,
        originalName: invoice.originalName,
        mimeType: invoice.mimeType,
        size: invoice.fileSize,
      };
    }),
  );
}

function buildReadme(month: string, evidenceCount: number) {
  return [
    "CATALINA #06 — REPORTE Y EVIDENCIAS MENSUALES",
    `Período: ${month}`,
    `Evidencias incluidas: ${evidenceCount}`,
    "",
    "El archivo reporte/ contiene el CSV financiero generado para el período.",
    "Las facturas y fotografías están ordenadas por período dentro de evidencias/.",
    "Este paquete es una copia de exportación y no modifica ni elimina los archivos originales archivados.",
  ].join("\n");
}

async function downloadEvidence(storageKey: string, originalName: string) {
  const signedUrl = await storageGetSignedUrl(storageKey);
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`No fue posible incluir la evidencia “${originalName}” en la exportación.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function createMonthlyEvidenceExport(input: { month: string; records: MonthlyEvidenceRecord[] }) {
  const monthlyReport = (await generatePolarsReport({
    mode: "monthly_report",
    selectedMonth: input.month,
    expenses: input.records,
  })) as { filename: string; csv: string; summary: unknown };
  const inventory = buildMonthlyEvidenceInventory(input.records, input.month);
  const rootFolder = `catalina-06-${monthlyFolderName(input.month)}`;
  const archiverMod = (await import("archiver")) as any;
  const archiverFn = typeof archiverMod === "function" ? archiverMod : (archiverMod.default || archiverMod.create || archiverMod);
  const archive = archiverFn("zip", { zlib: { level: 9 } });
  const chunks: Buffer[] = [];

  const archiveBuffer = new Promise<Buffer>((resolve, reject) => {
    archive.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));
  });

  archive.append(monthlyReport.csv, { name: `${rootFolder}/reporte/${monthlyReport.filename}` });
  archive.append(buildReadme(input.month, inventory.length), { name: `${rootFolder}/LEEME.txt` });
  archive.append(
    JSON.stringify(
      {
        project: "Catalina #06",
        reportingMonth: input.month,
        generatedAt: new Date().toISOString(),
        evidenceCount: inventory.length,
        evidences: inventory,
      },
      null,
      2,
    ),
    { name: `${rootFolder}/inventario-evidencias.json` },
  );

  const invoicesById = new Map<number, MonthlyInvoice>();
  input.records.forEach(record => record.invoices.forEach(invoice => invoicesById.set(invoice.id, invoice)));
  for (const item of inventory) {
    const invoice = invoicesById.get(item.invoiceId);
    if (!invoice) throw new Error("No fue posible localizar una evidencia para el paquete mensual.");
    archive.append(await downloadEvidence(invoice.storageKey, item.originalName), { name: `${rootFolder}/${item.archivePath}` });
  }

  await archive.finalize();
  const zip = await archiveBuffer;
  const fileName = monthlyExportFileName(input.month);
  const stored = await storagePut(`catalina-06/exportaciones/${input.month}/${fileName}`, zip, "application/zip");
  const url = await storageGetSignedUrl(stored.key);

  return { filename: fileName, url, evidenceCount: inventory.length, summary: monthlyReport.summary };
}
