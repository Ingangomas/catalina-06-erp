import { createApp } from "../server/_core/app";

// La importación estática garantiza que @vercel/node empaquete la aplicación
// Express y todos sus módulos necesarios dentro de la función.
const app = createApp();

export default app;
