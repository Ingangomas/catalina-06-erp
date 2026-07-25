export const USER_ROLE_LABELS = {
  socio_1: "Socio 1 (Ing. Angomas)",
  socio_2: "Socio 2 (Ing. Johan)",
  contador: "Contador",
  admin: "Administrador",
  user: "Usuario sin asignar",
} as const;

export const EXPENSE_TYPE_LABELS = {
  socio_1: "Socio 1",
  socio_2: "Socio 2",
  global_shared: "Global/Compartido",
} as const;

export const EXPENSE_STATUS_LABELS = {
  draft: "Borrador",
  submitted: "Enviado",
  approved: "Aprobado",
  rejected: "Rechazado",
} as const;

export const EXPENSE_CATEGORY_DEFINITIONS = [
  { label: "Materiales", color: "#E9A23B", sortOrder: 1 },
  { label: "Mano de Obra", color: "#4667D9", sortOrder: 2 },
  { label: "Transporte", color: "#39A77E", sortOrder: 3 },
  { label: "Botes", color: "#D65B57", sortOrder: 4 },
  { label: "Otros", color: "#8E75D2", sortOrder: 5 },
] as const;

export const ALLOWED_INVOICE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

export const MAX_INVOICE_FILE_SIZE_BYTES = 10 * 1024 * 1024;
