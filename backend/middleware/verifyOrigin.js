import { ALLOWED_ORIGINS } from '../config/allowedOrigins.js';

/**
 * Defensa extra anti-CSRF para /auth/refresh (Paso 09 de BLUEPRINT.md).
 *
 * La cookie de refresh ya viaja con `SameSite=Lax`, que bloquea la mayoría de
 * los envíos entre sitios. Pero "Lax" todavía permite que la cookie viaje en
 * ciertas navegaciones de nivel superior (un link, un formulario GET) — esta
 * capa cierra ese resquicio específicamente para /auth/refresh, la única ruta
 * pública que actúa solo con la cookie (sin pedir contraseña ni Bearer token).
 *
 * Un navegador SIEMPRE manda el header Origin en peticiones POST/fetch — si
 * no viene, o viene con un valor que no es el nuestro, se rechaza. Es
 * deliberadamente estricto: esta ruta no la llama nadie más que nuestro
 * propio frontend.
 */
export const verificarOrigen = (req, res, next) => {
  const origen = req.headers.origin;

  if (!origen || !ALLOWED_ORIGINS.includes(origen)) {
    return res.status(403).json({
      success: false,
      message: 'Origen no permitido'
    });
  }

  next();
};
