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
import { protect, authorize, authorizePatientAccess } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas de mediciones
router.route('/')
  .post(authorize('admin', 'professional', 'patient'), createMeasurement);

// Pertenencia verificada en la ruta (Paso 04 de BLUEPRINT.md): antes cada controlador
// hacía su propio chequeo y ninguno cubría al profesional no asignado.
router.get('/patient/:patientId', authorizePatientAccess('patientId'), getPatientMeasurements);
router.get('/compare/:id1/:id2', compareMeasurements);
router.get('/progress/:patientId/:perimeter', authorizePatientAccess('patientId'), getPerimeterProgress);

router.route('/:id')
  .get(getMeasurement)
  .put(authorize('admin', 'professional', 'patient'), updateMeasurement)
  .delete(authorize('admin', 'professional'), deleteMeasurement);

export default router;
