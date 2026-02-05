import express from 'express';
import {
  getAvailability,
  updateWeeklySchedule,
  blockDate,
  unblockDate,
  getAvailableSlots
} from '../controllers/availabilityController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Obtener slots disponibles para una fecha (accesible para todos)
router.get('/:professionalId/slots/:date', getAvailableSlots);

// Obtener disponibilidad completa de un profesional
router.get('/:professionalId', getAvailability);

// Actualizar horario semanal (solo staff)
router.put('/:professionalId/schedule', authorize('admin', 'professional'), updateWeeklySchedule);

// Bloquear/desbloquear fechas (solo staff)
router.post('/:professionalId/block', authorize('admin', 'professional'), blockDate);
router.delete('/:professionalId/block/:blockId', authorize('admin', 'professional'), unblockDate);

export default router;
