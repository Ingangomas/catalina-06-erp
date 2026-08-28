import mysql from "mysql2/promise";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no está configurada.");

const targetDirectory = process.argv[2];
if (!targetDirectory) throw new Error("Indica el directorio de respaldo como primer argumento.");

mkdirSync(targetDirectory, { recursive: true });
const connection = await mysql.createConnection(connectionString);

try {
  const [rows] = await connection.execute(`
    SELECT
      invoice.id AS invoiceId,
      invoice.expenseId,
      invoice.storageKey,
      invoice.fileUrl,
      invoice.originalName,
      invoice.mimeType,
      invoice.fileSize,
      invoice.archivedMonth,
      invoice.uploadedAt,
      expense.description AS expenseDescription,
      expense.reportingMonth,
      expense.status AS expenseStatus
    FROM expense_invoices AS invoice
    INNER JOIN expenses AS expense ON expense.id = invoice.expenseId
    ORDER BY invoice.archivedMonth ASC, invoice.expenseId ASC, invoice.id ASC
  `);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = join(targetDirectory, `catalina-06-evidencias-${stamp}.json`);
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        project: "Catalina #06",
        generatedAt: new Date().toISOString(),
        evidenceCount: rows.length,
        evidences: rows,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  process.stdout.write(`${outputPath}\n`);
} finally {
  connection.destroy();
}
