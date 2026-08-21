import { createApp } from "../server/_core/app";

// Punto de entrada explícito para el constructor @vercel/node.
// Las reglas de vercel.json conservan la URL original bajo /api.
const app = createApp();

export default app;
