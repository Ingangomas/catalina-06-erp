import { createApp } from "../_core/app";

// Entrada explícita de la función @vercel/node. Mantenerla fuera de /api evita
// que el detector automático compita con el constructor estático de Vite.
const app = createApp();

export default app;
