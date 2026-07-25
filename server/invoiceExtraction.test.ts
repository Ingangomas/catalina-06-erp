import { describe, expect, it, vi } from "vitest";

const { listLLMModels, invokeLLM } = vi.hoisted(() => ({
  listLLMModels: vi.fn(),
  invokeLLM: vi.fn(),
}));

vi.mock("./_core/llm", () => ({ listLLMModels, invokeLLM }));

import { extractInvoiceExpense } from "./invoiceExtraction";

describe("extracción asistida de facturas", () => {
  it("usa Gemini 3.1 disponible y normaliza la propuesta de gasto antes de guardarla", async () => {
    listLLMModels.mockResolvedValue({ data: [{ id: "gemini-3.1-pro-preview" }] });
    invokeLLM.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              description: "Compra de cemento Portland",
              amount: 4875.5,
              incurredOn: "2026-07-25",
              reportingMonth: "2026-07",
              categoryLabel: "Materiales",
              vendor: "Ferretería Central",
              confidence: 1.2,
              notes: "Monto visible en el total de la factura.",
            }),
          },
        },
      ],
    });

    const result = await extractInvoiceExpense({
      fileName: "factura-ferreteria.jpg",
      mimeType: "image/jpeg",
      base64: "aGVsbG8=",
      categoryLabels: ["Materiales", "Mano de Obra", "Transporte", "Botes", "Otros"],
    });

    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemini-3.1-pro-preview",
      responseFormat: expect.objectContaining({ type: "json_schema" }),
    }));
    expect(result).toEqual({
      description: "Compra de cemento Portland",
      amount: 4875.5,
      incurredOn: "2026-07-25",
      reportingMonth: "2026-07",
      categoryLabel: "Materiales",
      vendor: "Ferretería Central",
      confidence: 1,
      notes: "Monto visible en el total de la factura.",
      model: "gemini-3.1-pro-preview",
    });
  });

  it("usa el modelo Gemini alternativo cuando el preferido no está disponible", async () => {
    listLLMModels.mockResolvedValue({ data: [{ id: "gemini-3-flash-preview" }] });
    invokeLLM.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ description: "", amount: 0, incurredOn: "", reportingMonth: "", categoryLabel: "", vendor: "", confidence: -1, notes: "Datos ilegibles" }) } }],
    });

    const result = await extractInvoiceExpense({
      fileName: "recibo.png",
      mimeType: "image/png",
      base64: "aGVsbG8=",
      categoryLabels: ["Materiales"],
    });

    expect(result.model).toBe("gemini-3-flash-preview");
    expect(result.amount).toBe(0);
    expect(result.confidence).toBe(0);
  });
});
