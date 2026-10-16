import express from 'express';
import { getPatientSlots, createSlot, updateSlot, deleteSlot } from '../controllers/recurringSlotController.js';
import { protect, authorizePatientAccess } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/', createSlot);

// "me" antes que ":patientId" (mismo patrón que extraSessionRoutes.js). Pertenencia obligatoria para el personal.
router.get('/patient/me', getPatientSlots);
router.get('/patient/:patientId', authorizePatientAccess('patientId'), getPatientSlots);

router.route('/:id')
  .put(updateSlot)
  .delete(deleteSlot);

export default router;
