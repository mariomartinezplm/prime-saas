import express from 'express';
import {
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  refresh,
  logout
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { verificarOrigen } from '../middleware/verifyOrigin.js';
import {
  loginLimiter,
  forgotPasswordLimiter,
  setPasswordLimiter,
  refreshLimiter
} from '../middleware/rateLimiter.js';

const router = express.Router();

// Rutas públicas
// NOTA DE SEGURIDAD (Paso 01 de BLUEPRINT.md): se eliminaron POST /register,
// POST /verify-identity y PUT /set-password/:verifyToken. El alta de pacientes
// es solo por invitación (Paso 12) y el reseteo, solo por email (Paso 13).
// Límite de intentos (Paso 06): sin esto se pueden probar contraseñas sin parar
router.post('/login', loginLimiter, login);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.put('/reset-password/:resetToken', setPasswordLimiter, resetPassword);

// Solo usan la cookie de refresh, no requieren Bearer token (Paso 08): un
// access token vencido no debe impedir renovar la sesión ni cerrarla.
// /refresh además exige que el Origin sea el nuestro (Paso 09, defensa extra
// anti-CSRF): es la única ruta pública que actúa solo con la cookie.
router.post('/refresh', refreshLimiter, verificarOrigen, refresh);
router.post('/logout', logout);

// Rutas protegidas
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

export default router;

