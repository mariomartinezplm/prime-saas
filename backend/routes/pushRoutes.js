import express from 'express';
import { getPushStatus, subscribe, unsubscribe } from '../controllers/pushController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Cada persona gestiona solo sus propios dispositivos: todas las rutas son del usuario autenticado
router.use(protect);

router.get('/status', getPushStatus);
router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);

export default router;
