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

// Todas las rutas requieren autenticación y rol de admin
router.use(protect);
router.use(authorize('admin'));

// Rutas de gestión de usuarios
router.route('/')
  .get(getAllUsers)
  .post(createUser);

router.get('/stats/dashboard', getDashboardStats);

router.route('/:id')
  .get(getUserById)
  .put(updateUser)
  .delete(deleteUser);

router.get('/:id/profile', getPatientProfile);

export default router;
