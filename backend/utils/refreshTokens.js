import crypto from 'crypto';

/**
 * Helpers de refresh tokens (Paso 08 de BLUEPRINT.md).
 *
 * Decisión de Mario: la sesión vence a los 30 días FIJOS desde el login, use
 * la app o no la use — más seguro que una ventana que se renueva sola, porque
 * limita el daño de una sesión robada que nadie nota.
 */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
export const REFRESH_COOKIE_NAME = 'refreshToken';

// Mismo patrón sha256 que ya usa forgotPassword/resetPassword en
// authController.js: solo el hash va a la base de datos, nunca el valor real.
export const hashToken = (rawToken) =>
  crypto.createHash('sha256').update(rawToken).digest('hex');

// 32 bytes al azar, igual que el token de reseteo de contraseña.
export const generarRefreshToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  return { rawToken, tokenHash: hashToken(rawToken) };
};

export const generarFamilyId = () => crypto.randomBytes(16).toString('hex');

// Secure solo en producción: en dev local por HTTP el navegador descartaría
// de inmediato una cookie Secure, y no se podría probar el flujo.
const cookieBaseOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth'
});

export const setRefreshCookie = (res, rawToken) => {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    ...cookieBaseOptions(),
    maxAge: REFRESH_TOKEN_TTL_MS
  });
};

export const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieBaseOptions());
};
