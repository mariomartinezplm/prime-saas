import rateLimit from 'express-rate-limit';

/**
 * Límites de uso (Paso 06 de BLUEPRINT.md, tabla §5.3).
 *
 * Sin esto, alguien puede probar contraseñas de forma automática hasta acertar:
 * miles de intentos por minuto contra la cuenta de un paciente. El límite no
 * molesta a una persona real (nadie escribe mal su contraseña 6 veces en 15
 * minutos) pero detiene en seco un ataque automatizado.
 */

const respuesta = (mensaje) => ({
  success: false,
  code: 'RATE_LIMITED',
  message: mensaje
});

// Se limita por IP + email juntos: así un atacante que prueba muchas cuentas desde
// una IP queda frenado, y alguien que comparte IP (una clínica, un wifi público)
// no bloquea a sus compañeros por equivocarse en SU propia cuenta.
const porIpYEmail = (req) => {
  const ip = req.ip || 'sin-ip';
  const identificador = (req.body?.email || req.body?.identifier || '').toString().toLowerCase();
  return `${ip}|${identificador}`;
};

const base = {
  standardHeaders: true, // informa el límite en las cabeceras estándar
  legacyHeaders: false
};

export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: porIpYEmail,
  // Un login correcto no gasta intentos: solo penaliza los fallidos
  skipSuccessfulRequests: true,
  message: respuesta('Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.')
});

export const forgotPasswordLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: porIpYEmail,
  message: respuesta('Demasiadas solicitudes de recuperación. Inténtalo de nuevo en una hora.')
});

// Para definir contraseña con un token (reseteo hoy, invitación en el Paso 12)
export const setPasswordLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: respuesta('Demasiados intentos. Inténtalo de nuevo en una hora.')
});

// Techo general para toda la API: no estorba el uso normal, pero corta un
// script que intente recorrer la base de datos entera.
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 5 * 60 * 1000,
  limit: 300,
  keyGenerator: (req) => (req.user?._id ? req.user._id.toString() : (req.ip || 'sin-ip')),
  message: respuesta('Demasiadas peticiones. Espera un momento.')
});
