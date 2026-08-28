import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no está configurada.");

const targetDirectory = process.argv[2];
if (!targetDirectory) throw new Error("Indica el directorio de respaldo como primer argumento.");

const url = new URL(connectionString);
const database = url.pathname.replace(/^\//, "");
if (!database) throw new Error("La URL de base de datos no incluye una base de datos.");

mkdirSync(targetDirectory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = join(targetDirectory, `catalina-06-mysql-${stamp}.sql`);
const tempDirectory = mkdtempSync(join(tmpdir(), "catalina-mysql-"));
const defaultsPath = join(tempDirectory, "client.cnf");

try {
  writeFileSync(
    defaultsPath,
    `[client]\nhost=${url.hostname}\nport=${url.port || "3306"}\nuser=${decodeURIComponent(url.username)}\npassword=${decodeURIComponent(url.password)}\n`,
    { mode: 0o600 },
  );
  chmodSync(defaultsPath, 0o600);
  execFileSync(
    "mysqldump",
    [
      `--defaults-extra-file=${defaultsPath}`,
      "--skip-lock-tables",
      "--skip-routines",
      "--skip-events",
      "--no-tablespaces",
      "--skip-comments",
      "--result-file",
      outputPath,
      database,
    ],
    { stdio: "inherit" },
  );
  process.stdout.write(`${outputPath}\n`);
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
