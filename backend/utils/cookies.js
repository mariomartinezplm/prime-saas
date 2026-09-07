/**
 * Lectura de cookies sin la dependencia `cookie-parser` (Paso 08 de
 * BLUEPRINT.md). Igual que con `sanitizeMongo` en el Paso 06: la tarea es
 * parsear "nombre1=valor1; nombre2=valor2" de un header, algo trivial que no
 * justifica una dependencia externa más — y solo dos rutas necesitan leer
 * cookies (/auth/refresh, /auth/logout), así que no hace falta un middleware
 * global que procese cookies en cada petición del sistema.
 */
export const leerCookie = (req, nombre) => {
  const header = req.headers?.cookie;
  if (!header) return undefined;

  for (const par of header.split(';')) {
    const idx = par.indexOf('=');
    if (idx === -1) continue;

    const clave = par.slice(0, idx).trim();
    if (clave !== nombre) continue;

    const valorCrudo = par.slice(idx + 1).trim();
    try {
      return decodeURIComponent(valorCrudo);
    } catch {
      // Si viene mal codificado, se devuelve tal cual en vez de reventar
      return valorCrudo;
    }
  }
  return undefined;
};
