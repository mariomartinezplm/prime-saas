import express from 'express';
import { listClosures, closeSlot, reopenSlot } from '../controllers/slotClosureController.js';
import { protect, authorize, authorizeSelfOrAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'professional'));

router.get('/professional/:professionalId', authorizeSelfOrAdmin('professionalId'), listClosures);
router.post('/professional/:professionalId', authorizeSelfOrAdmin('professionalId'), closeSlot);
router.delete('/:id', reopenSlot);

export default router;
