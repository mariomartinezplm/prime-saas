/**
 * Orígenes permitidos (Paso 09 de BLUEPRINT.md).
 *
 * Una sola fuente de verdad: la usan tanto CORS (server.js) como el chequeo
 * de Origin en /auth/refresh (defensa extra anti-CSRF), para no mantener la
 * misma lista escrita dos veces.
 *
 * NOTA: el BLUEPRINT.md original menciona `http://localhost:5173` para
 * desarrollo, pero este proyecto tiene el puerto de Vite fijado en 8080
 * (ver vite.config.ts: server.port = 8080) — se usa el puerto real, no el
 * default de Vite que el blueprint asumía.
 */
export const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL, // producción: https://app.primefh.cl
  'http://localhost:8080'    // dev local: puerto real configurado en vite.config.ts
].filter(Boolean);
