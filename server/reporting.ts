import { spawn } from "node:child_process";
import path from "node:path";

type ReportingPayload = {
  mode: "analytics" | "monthly_report";
  selectedMonth: string;
  expenses: Array<{
    id: number;
    description: string;
    amount: number;
    incurredOn: string | Date;
    reportingMonth: string;
    expenseType: string;
    status: string;
    category: { label: string };
    createdBy: { name: string | null };
  }>;
};

export async function generatePolarsReport(payload: ReportingPayload) {
  const scriptPath = path.resolve(process.cwd(), "scripts", "generate_monthly_report.py");

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const child = spawn("python3", [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      stdout += chunk;
    });
    child.stderr.on("data", chunk => {
      stderr += chunk;
    });
    child.on("error", error => {
      reject(new Error(`No se pudo iniciar Polars: ${error.message}`));
    });
    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(`Polars finalizó con código ${code}: ${stderr || "sin detalle"}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("Polars devolvió un resultado no válido."));
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}
