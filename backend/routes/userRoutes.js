import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getPatientProfile,
  getDashboardStats
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas de gestión de usuarios
router.route('/')
  .get(getAllUsers) // Controller manejará permisos específicos
  .post(authorize('admin', 'professional'), createUser);

router.get('/stats/dashboard', authorize('admin', 'professional'), getDashboardStats);

router.route('/:id')
  .get(getUserById) // Controller manejará permisos (ej: ver propio perfil)
  .put(authorize('admin', 'professional'), updateUser)
  .delete(authorize('admin', 'professional'), deleteUser);

router.get('/:id/profile', getPatientProfile);

export default router;
