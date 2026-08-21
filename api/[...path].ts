import { createApp } from "../server/_core/app";

// Vercel ejecuta la aplicación Express como una función Node por cada solicitud
// bajo /api, sin abrir ni administrar un puerto propio.
const app = createApp();

export default app;
