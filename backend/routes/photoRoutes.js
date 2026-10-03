import express from 'express';
import multer from 'multer';
import {
  requireActivePlanToUpload,
  uploadPhoto,
  getPatientPhotos,
  updatePhoto,
  deletePhoto
} from '../controllers/photoController.js';
import { protect, authorizePatientAccess } from '../middleware/auth.js';
import { MAX_PHOTO_SIZE_BYTES } from '../models/ProgressPhoto.js';

const router = express.Router();

// La foto se mantiene en memoria solo el tiempo que tarda en llegar a R2
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_SIZE_BYTES, files: 1 }
});

const parseSingleFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'La foto supera el máximo de 10 MB' });
    }
    return res.status(400).json({ success: false, message: 'No se pudo leer la foto enviada' });
  });
};

router.use(protect);

// Orden deliberado: autenticación → pertenencia → plan activo → recién ahí se recibe la foto
router.post(
  '/patient/:patientId',
  authorizePatientAccess('patientId'),
  requireActivePlanToUpload,
  parseSingleFile,
  uploadPhoto
);
router.get('/patient/:patientId', authorizePatientAccess('patientId'), getPatientPhotos);

// La pertenencia y la visibilidad se verifican en el controlador (el id de la URL es el de la foto)
router.route('/:id')
  .put(updatePhoto)
  .delete(deletePhoto);

export default router;
