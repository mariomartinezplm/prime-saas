import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getPatientProfile,
  getDashboardStats,
  syncAirtableUsers
} from '../controllers/userController.js';
import { protect, authorize, authorizePatientAccess } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas de gestión de usuarios
router.route('/')
  .get(getAllUsers) // Controller manejará permisos específicos
  .post(authorize('admin', 'professional'), createUser);

// Solo admin: la importación masiva crea cuentas, no es una acción de rutina
router.post('/sync-airtable', authorize('admin'), syncAirtableUsers);

router.get('/stats/dashboard', authorize('admin', 'professional'), getDashboardStats);

// Pertenencia obligatoria: un paciente solo se ve a sí mismo, un profesional solo
// a sus pacientes asignados. Sin esto, cambiar el id en la URL exponía la ficha
// clínica completa de cualquier persona (Paso 04 de BLUEPRINT.md).
router.route('/:id')
  .get(authorizePatientAccess('id'), getUserById)
  .put(authorize('admin', 'professional'), updateUser)
  // Solo admin: desactiva la cuenta (no borra el historial clínico)
  .delete(authorize('admin'), deleteUser);

router.get('/:id/profile', authorizePatientAccess('id'), getPatientProfile);

export default router;
