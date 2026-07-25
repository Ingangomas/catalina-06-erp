import { describe, expect, it } from "vitest";
import { appendGridRow, removeGridRow, resolveGridColor } from "./expenseGrid";

describe("utilidades de la cuadrícula de gastos", () => {
  it("inserta y elimina filas sin mutar el conjunto previo", () => {
    const initial = [{ key: "fila-1", description: "Cemento" }];
    const withNewRow = appendGridRow(initial, { key: "fila-2", description: "Arena" });

    expect(withNewRow).toEqual([
      { key: "fila-1", description: "Cemento" },
      { key: "fila-2", description: "Arena" },
    ]);
    expect(initial).toHaveLength(1);
    expect(removeGridRow(withNewRow, "fila-1")).toEqual([{ key: "fila-2", description: "Arena" }]);
  });

  it("resuelve colores persistidos por columna y fila con valor de respaldo", () => {
    const styles = [
      { targetType: "column" as const, targetKey: "monto", backgroundColor: "#fff4cc" },
      { targetType: "row" as const, targetKey: "52", backgroundColor: "#e9f8ef" },
    ];

    expect(resolveGridColor(styles, "column", "monto", "#ffffff")).toBe("#fff4cc");
    expect(resolveGridColor(styles, "row", "52", "#ffffff")).toBe("#e9f8ef");
    expect(resolveGridColor(styles, "column", "fecha", "#f8f7f3")).toBe("#f8f7f3");
  });
});
