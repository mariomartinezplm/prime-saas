import express from 'express';
import {
  getAvailability,
  updateWeeklySchedule,
  blockDate,
  unblockDate,
  getAvailableSlots
} from '../controllers/availabilityController.js';
import { protect, authorize, authorizeSelfOrAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Obtener slots disponibles para una fecha (accesible para todos)
router.get('/:professionalId/slots/:date', getAvailableSlots);

// Obtener disponibilidad completa de un profesional
router.get('/:professionalId', getAvailability);

// Configuración de agenda: cada profesional solo la suya; el admin, la de cualquiera.
// Antes, cualquier profesional podía reescribir el horario de otro (Paso 04 de BLUEPRINT.md).
router.put('/:professionalId/schedule', authorize('admin', 'professional'), authorizeSelfOrAdmin('professionalId'), updateWeeklySchedule);
router.post('/:professionalId/block', authorize('admin', 'professional'), authorizeSelfOrAdmin('professionalId'), blockDate);
router.delete('/:professionalId/block/:blockId', authorize('admin', 'professional'), authorizeSelfOrAdmin('professionalId'), unblockDate);

export default router;
