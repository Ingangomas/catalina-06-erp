import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({ storageGetSignedUrl: vi.fn(), storagePut: vi.fn() }));
const reportingMocks = vi.hoisted(() => ({ generatePolarsReport: vi.fn() }));

vi.mock("./storage", () => storageMocks);
vi.mock("./reporting", () => reportingMocks);

import {
  buildMonthlyEvidenceInventory,
  createMonthlyEvidenceExport,
  monthlyExportFileName,
  monthlyFolderName,
} from "./monthlyEvidenceExport";
import * as unzipper from "unzipper";

describe("exportación mensual de evidencias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ordena las evidencias bajo el período solicitado y protege el nombre archivado", () => {
    const inventory = buildMonthlyEvidenceInventory(
      [
        {
          id: 41,
          description: "Compra de cemento / obra",
          amount: 1000,
          incurredOn: new Date("2026-07-03T12:00:00.000Z"),
          reportingMonth: "2026-07",
          expenseType: "global_shared",
          status: "approved",
          category: { label: "Materiales" },
          createdBy: { name: "Ing. Raymond" },
          invoices: [
            {
              id: 9,
              originalName: "../Factura julio 01.jpeg",
              storageKey: "catalina-06/facturas/2026-07/gasto-41/factura.jpeg",
              mimeType: "image/jpeg",
              fileSize: 3200,
              archivedMonth: "2026-07",
              uploadedAt: new Date(),
            },
          ],
        },
      ],
      "2026-07",
    );

    expect(monthlyFolderName("2026-07")).toBe("julio-2026");
    expect(monthlyExportFileName("2026-07")).toBe("catalina-06-reporte-evidencias-2026-07.zip");
    expect(inventory[0]?.archivePath).toBe("evidencias/julio-2026/2026-07-03__gasto-41__Compra-de-cemento-obra__factura-9__..-Factura-julio-01.jpeg");
  });

  it("crea un ZIP con el CSV y una copia de la evidencia sin cambiar el archivo origen", async () => {
    const record = {
      id: 41,
      description: "Cemento",
      amount: 1000,
      incurredOn: new Date("2026-07-03T12:00:00.000Z"),
      reportingMonth: "2026-07",
      expenseType: "global_shared",
      status: "approved",
      category: { label: "Materiales" },
      createdBy: { name: "Ing. Raymond" },
      invoices: [
        {
          id: 9,
          originalName: "factura.jpeg",
          storageKey: "catalina-06/facturas/2026-07/gasto-41/factura.jpeg",
          mimeType: "image/jpeg",
          fileSize: 4,
          archivedMonth: "2026-07",
          uploadedAt: new Date(),
        },
      ],
    };
    reportingMocks.generatePolarsReport.mockResolvedValue({
      filename: "catalina-06-gastos-2026-07.csv",
      csv: "REPORTE JULIO",
      summary: { expenseCount: 1 },
    });
    storageMocks.storageGetSignedUrl
      .mockResolvedValueOnce("data:application/octet-stream;base64,AQIDBA==")
      .mockResolvedValueOnce("https://example.com/exportacion.zip");
    storageMocks.storagePut.mockResolvedValue({ key: "catalina-06/exportaciones/2026-07/zip", url: "/manus-storage/export.zip" });

    const result = await createMonthlyEvidenceExport({ month: "2026-07", records: [record] });

    expect(storageMocks.storageGetSignedUrl).toHaveBeenCalledWith(record.invoices[0].storageKey);
    expect(storageMocks.storagePut).toHaveBeenCalledWith(
      "catalina-06/exportaciones/2026-07/catalina-06-reporte-evidencias-2026-07.zip",
      expect.any(Buffer),
      "application/zip",
    );
    const zip = storageMocks.storagePut.mock.calls[0]?.[1] as Buffer;
    const directory = await unzipper.Open.buffer(zip);
    const archivePaths = directory.files.map(file => file.path).sort();
    const root = "catalina-06-julio-2026";
    expect(archivePaths).toEqual(expect.arrayContaining([
      `${root}/LEEME.txt`,
      `${root}/inventario-evidencias.json`,
      `${root}/reporte/catalina-06-gastos-2026-07.csv`,
      `${root}/evidencias/julio-2026/2026-07-03__gasto-41__Cemento__factura-9__factura.jpeg`,
    ]));
    const evidenceEntry = directory.files.find(file => file.path.endsWith("factura-9__factura.jpeg"));
    const inventoryEntry = directory.files.find(file => file.path.endsWith("inventario-evidencias.json"));
    expect(await evidenceEntry?.buffer()).toEqual(Buffer.from([1, 2, 3, 4]));
    expect((await inventoryEntry?.buffer())?.toString("utf8")).toContain("evidencias/julio-2026/");
    expect(storageMocks.storageGetSignedUrl).toHaveBeenCalledTimes(2);
    expect(storageMocks.storagePut).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ filename: "catalina-06-reporte-evidencias-2026-07.zip", evidenceCount: 1, url: "https://example.com/exportacion.zip" });
  });
});
