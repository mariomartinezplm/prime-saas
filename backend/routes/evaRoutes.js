import express from 'express';
import {
  createEVARecord,
  getPatientEVARecords,
  getEVARecord,
  updateEVARecord,
  deleteEVARecord,
  getPainEvolution,
  getAffectedAreas,
  getPainSummary
} from '../controllers/evaController.js';
import { protect, authorize, authorizePatientAccess } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas de EVA
router.route('/')
  .post(authorize('admin', 'professional'), createEVARecord);

// Pertenencia verificada en la ruta (Paso 04 de BLUEPRINT.md)
router.get('/patient/:patientId', authorizePatientAccess('patientId'), getPatientEVARecords);
router.get('/evolution/:patientId/:bodyArea', authorizePatientAccess('patientId'), getPainEvolution);
router.get('/affected-areas/:patientId', authorizePatientAccess('patientId'), getAffectedAreas);
router.get('/summary/:patientId', authorizePatientAccess('patientId'), getPainSummary);

router.route('/:id')
  .get(getEVARecord)
  .put(authorize('admin', 'professional'), updateEVARecord)
  .delete(authorize('admin', 'professional'), deleteEVARecord);

export default router;
