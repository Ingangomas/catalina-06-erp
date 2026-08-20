import { createConnection } from "mysql2/promise";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL no está configurada; no se puede generar el respaldo.");
}

const destination = process.env.MIGRATION_BACKUP_DIR || "/home/ubuntu/catalina_erp-backups";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const mysqlUrl = new URL(databaseUrl);
const database = decodeURIComponent(mysqlUrl.pathname.replace(/^\//, ""));

if (!database) {
  throw new Error("DATABASE_URL no contiene el nombre de la base de datos.");
}

mkdirSync(destination, { recursive: true });
const credentialsPath = path.join(destination, `.mysql-${timestamp}.cnf`);
const snapshotPath = path.join(destination, `catalina-06-mysql-logico-${timestamp}.json`);
const inventoryPath = path.join(destination, `catalina-06-evidencias-${timestamp}.json`);
const manifestPath = path.join(destination, `catalina-06-respaldo-${timestamp}.json`);

const credentials = [
  "[client]",
  `host=${mysqlUrl.hostname}`,
  `port=${mysqlUrl.port || "3306"}`,
  `user=${decodeURIComponent(mysqlUrl.username)}`,
  `password=${decodeURIComponent(mysqlUrl.password)}`,
  "ssl-mode=REQUIRED",
  "",
].join("\n");

writeFileSync(credentialsPath, credentials, { mode: 0o600 });
chmodSync(credentialsPath, 0o600);

try {
  const connection = await createConnection(databaseUrl);
  const [tableRows] = await connection.query("SHOW TABLES");
  const tables = tableRows.map(row => Object.values(row)[0]);
  const databaseSnapshot = {};

  for (const table of tables) {
    const [schemaRows] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
    const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
    databaseSnapshot[table] = {
      createStatement: Object.values(schemaRows[0])[1],
      rows,
    };
  }

  writeFileSync(
    snapshotPath,
    JSON.stringify(
      {
        project: "Catalina #06",
        sourceDatabase: database,
        generatedAt: new Date().toISOString(),
        tables: databaseSnapshot,
      },
      null,
      2,
    ),
  );

  const [evidences] = await connection.query(
    `SELECT
       ei.id AS invoiceId,
       ei.expenseId AS expenseId,
       ei.storageKey AS storageKey,
       ei.originalName AS originalName,
       ei.mimeType AS mimeType,
       ei.fileSize AS fileSize,
       ei.archivedMonth AS archivedMonth,
       ei.uploadedAt AS uploadedAt,
       e.reportingMonth AS reportingMonth,
       e.status AS expenseStatus
     FROM expense_invoices ei
     INNER JOIN expenses e ON e.id = ei.expenseId
     ORDER BY ei.archivedMonth, ei.id`,
  );
  await connection.end();

  writeFileSync(
    inventoryPath,
    JSON.stringify(
      {
        project: "Catalina #06",
        generatedAt: new Date().toISOString(),
        evidenceCount: evidences.length,
        evidences,
      },
      null,
      2,
    ),
  );

  const sha256 = filePath => createHash("sha256").update(readFileSync(filePath)).digest("hex");
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        project: "Catalina #06",
        generatedAt: new Date().toISOString(),
        databaseDump: {
          filename: path.basename(snapshotPath),
          sha256: sha256(snapshotPath),
        },
        evidenceInventory: {
          filename: path.basename(inventoryPath),
          count: evidences.length,
          sha256: sha256(inventoryPath),
        },
      },
      null,
      2,
    ),
  );

  console.log(JSON.stringify({ destination, snapshotPath, inventoryPath, manifestPath, evidenceCount: evidences.length }));
} finally {
  if (existsSync(credentialsPath)) rmSync(credentialsPath, { force: true });
}
