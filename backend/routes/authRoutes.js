import express from 'express';
import {
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Rutas públicas
// NOTA DE SEGURIDAD (Paso 01 de BLUEPRINT.md): se eliminaron POST /register,
// POST /verify-identity y PUT /set-password/:verifyToken. El alta de pacientes
// es solo por invitación (Paso 12) y el reseteo, solo por email (Paso 13).
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resetToken', resetPassword);

// Rutas protegidas
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

export default router;

