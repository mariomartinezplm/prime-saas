import express from 'express';
import multer from 'multer';
import { uploadAvatar, getAvatar, deleteAvatar, MAX_AVATAR_BYTES } from '../controllers/avatarController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// La foto se mantiene en memoria solo el tiempo que tarda en limpiarse y llegar a R2
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AVATAR_BYTES, files: 1 } });

const parseSingleFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'La foto es demasiado pesada' });
    }
    return res.status(400).json({ success: false, message: 'No se pudo leer la foto enviada' });
  });
};

// Siempre la cuenta autenticada: ninguna de estas rutas recibe un id de usuario
router.use(protect);
router.route('/').get(getAvatar).put(parseSingleFile, uploadAvatar).delete(deleteAvatar);

export default router;
