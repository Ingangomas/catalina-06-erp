import { invokeLLM, listLLMModels, Message } from "./_core/llm";

type InvoiceExtractionInput = {
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "application/pdf";
  base64: string;
  categoryLabels: string[];
};

export type InvoiceExtraction = {
  description: string;
  amount: number;
  incurredOn: string;
  reportingMonth: string;
  categoryLabel: string;
  vendor: string;
  confidence: number;
  notes: string;
  model: string;
};

const invoiceSchema = {
  name: "invoice_expense_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      description: { type: "string" },
      amount: { type: "number" },
      incurredOn: { type: "string" },
      reportingMonth: { type: "string" },
      categoryLabel: { type: "string" },
      vendor: { type: "string" },
      confidence: { type: "number" },
      notes: { type: "string" },
    },
    required: [
      "description",
      "amount",
      "incurredOn",
      "reportingMonth",
      "categoryLabel",
      "vendor",
      "confidence",
      "notes",
    ],
    additionalProperties: false,
  },
} as const;

function parseExtraction(content: unknown, model: string): InvoiceExtraction {
  if (typeof content !== "string") throw new Error("La IA no devolvió una respuesta interpretable.");
  const parsed = JSON.parse(content) as Omit<InvoiceExtraction, "model">;
  const amount = Number(parsed.amount);
  const confidence = Number(parsed.confidence);
  return {
    description: typeof parsed.description === "string" ? parsed.description.trim() : "",
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    incurredOn: /^\d{4}-\d{2}-\d{2}$/.test(parsed.incurredOn) ? parsed.incurredOn : "",
    reportingMonth: /^\d{4}-\d{2}$/.test(parsed.reportingMonth) ? parsed.reportingMonth : "",
    categoryLabel: typeof parsed.categoryLabel === "string" ? parsed.categoryLabel : "",
    vendor: typeof parsed.vendor === "string" ? parsed.vendor.trim() : "",
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    notes: typeof parsed.notes === "string" ? parsed.notes.trim() : "",
    model,
  };
}

export async function extractInvoiceExpense(input: InvoiceExtractionInput): Promise<InvoiceExtraction> {
  const catalog = await listLLMModels();
  const preferredModel = catalog.data.some(model => model.id === "gemini-3.1-pro-preview")
    ? "gemini-3.1-pro-preview"
    : "gemini-3-flash-preview";
  const dataUrl = `data:${input.mimeType};base64,${input.base64}`;
  const documentPart = input.mimeType === "application/pdf"
    ? { type: "file_url" as const, file_url: { url: dataUrl, mime_type: input.mimeType } }
    : { type: "image_url" as const, image_url: { url: dataUrl, detail: "high" as const } };
  const categoryInstructions = input.categoryLabels.join(", ");
  const messages: Message[] = [
    {
      role: "system",
      content: "Eres un extractor contable preciso. Solo extraes información visible; nunca inventes montos, fechas ni proveedores. Devuelve un objeto JSON que cumpla el esquema solicitado.",
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Analiza la factura o recibo adjunto (${input.fileName}). Propón una descripción corta en español, el total pagado en DOP si es visible, la fecha en YYYY-MM-DD, el mes en YYYY-MM, el proveedor y una categoría. Las únicas categorías permitidas son: ${categoryInstructions}. Si el dato no aparece o no es legible, usa cadena vacía; para el monto usa 0. La confianza debe ir de 0 a 1. Incluye una nota breve para la persona que revisará el resultado.`,
        },
        documentPart,
      ],
    },
  ];
  const response = await invokeLLM({
    model: preferredModel,
    messages,
    maxTokens: 1600,
    responseFormat: { type: "json_schema", json_schema: invoiceSchema },
  });
  return parseExtraction(response.choices[0]?.message.content, preferredModel);
}
