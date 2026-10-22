import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getFinanceSummary } from '../controllers/financeController.js';

const router = express.Router();

// Solo personal (profesional o admin). Los pacientes NUNCA llegan aquí. El alcance (a quién se ve) lo decide el controlador por rol.
router.use(protect);
router.use(authorize('admin', 'professional'));
router.get('/summary', getFinanceSummary);

export default router;
