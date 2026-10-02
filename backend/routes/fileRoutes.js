import express from 'express';
import multer from 'multer';
import {
  requireActivePlanToUpload,
  uploadFile,
  getPatientFiles,
  getDownloadUrl,
  deleteFile
} from '../controllers/fileController.js';
import { protect, authorizePatientAccess } from '../middleware/auth.js';
import { MAX_FILE_SIZE_BYTES } from '../models/ClientFile.js';

const router = express.Router();

// El archivo se mantiene en memoria solo el tiempo que tarda en llegar a R2
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 }
});

const parseSingleFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'El archivo supera el máximo de 10 MB' });
    }
    return res.status(400).json({ success: false, message: 'No se pudo leer el archivo enviado' });
  });
};

router.use(protect);

// Orden deliberado: autenticación → pertenencia → plan activo → recién ahí se recibe el archivo
router.post(
  '/patient/:patientId',
  authorizePatientAccess('patientId'),
  requireActivePlanToUpload,
  parseSingleFile,
  uploadFile
);
router.get('/patient/:patientId', authorizePatientAccess('patientId'), getPatientFiles);

// La pertenencia de estas dos se verifica en el controlador (el id de la URL es del archivo, no del paciente)
router.get('/:id/download', getDownloadUrl);
router.delete('/:id', deleteFile);

export default router;
