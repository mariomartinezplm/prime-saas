import express from 'express';
import {
  createMeasurement,
  getPatientMeasurements,
  getMeasurement,
  updateMeasurement,
  deleteMeasurement,
  compareMeasurements,
  getPerimeterProgress
} from '../controllers/measurementController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas de mediciones
router.route('/')
  .post(authorize('admin', 'professional'), createMeasurement);

router.get('/patient/:patientId', getPatientMeasurements);
router.get('/compare/:id1/:id2', compareMeasurements);
router.get('/progress/:patientId/:perimeter', getPerimeterProgress);

router.route('/:id')
  .get(getMeasurement)
  .put(authorize('admin', 'professional'), updateMeasurement)
  .delete(authorize('admin', 'professional'), deleteMeasurement);

export default router;
