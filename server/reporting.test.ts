import { describe, expect, it } from "vitest";
import { generatePolarsReport } from "./reporting";

const fixtureExpenses = [
  {
    id: 1,
    description: "Materiales de construcción",
    amount: 1200,
    incurredOn: "2026-06-29",
    reportingMonth: "2026-06",
    expenseType: "socio_1",
    status: "approved",
    category: { label: "Materiales" },
    createdBy: { name: "Ing. Angomas" },
  },
  {
    id: 2,
    description: "Flete de materiales",
    amount: 800,
    incurredOn: "2026-07-08",
    reportingMonth: "2026-07",
    expenseType: "socio_2",
    status: "submitted",
    category: { label: "Transporte" },
    createdBy: { name: "Ing. Johan" },
  },
  {
    id: 3,
    description: "Contenedor de obra",
    amount: 400,
    incurredOn: "2026-07-16",
    reportingMonth: "2026-07",
    expenseType: "global_shared",
    status: "approved",
    category: { label: "Botes" },
    createdBy: { name: "Ing. Angomas" },
  },
];

describe("generación de reportes con Polars", () => {
  it("calcula totales mensuales por tipo y categoría", async () => {
    const result = (await generatePolarsReport({
      mode: "analytics",
      selectedMonth: "2026-07",
      expenses: fixtureExpenses,
    })) as {
      grandTotal: number;
      expenseCount: number;
      typeTotals: Array<{ expenseType: string; total: number }>;
      categoryTotals: Array<{ category: string; total: number }>;
      trend: Array<{ month: string; total: number }>;
    };

    expect(result.grandTotal).toBe(1200);
    expect(result.expenseCount).toBe(2);
    expect(result.typeTotals).toEqual([
      { expenseType: "socio_1", total: 0 },
      { expenseType: "socio_2", total: 800 },
      { expenseType: "participant", total: 0 },
      { expenseType: "global_shared", total: 400 },
    ]);
    expect(result.categoryTotals).toContainEqual({ category: "Transporte", total: 800 });
    expect(result.categoryTotals).toContainEqual({ category: "Botes", total: 400 });
    expect(result.trend).toEqual([
      { month: "2026-06", total: 1200 },
      { month: "2026-07", total: 1200 },
    ]);
  });

  it("construye un archivo CSV con resumen y detalle del período", async () => {
    const result = (await generatePolarsReport({
      mode: "monthly_report",
      selectedMonth: "2026-07",
      expenses: fixtureExpenses,
    })) as { filename: string; csv: string; summary: { grandTotal: number } };

    expect(result.filename).toBe("catalina-06-gastos-2026-07.csv");
    expect(result.summary.grandTotal).toBe(1200);
    expect(result.csv).toContain("REPORTE MENSUAL CATALINA #06 — 2026-07");
    expect(result.csv).toContain("Flete de materiales");
    expect(result.csv).toContain("Contenedor de obra");
  });
});
