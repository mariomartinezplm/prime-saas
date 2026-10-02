import crypto from 'crypto';
import ClientFile from '../models/ClientFile.js';
import User from '../models/User.js';
import { canAccessPatient } from '../middleware/auth.js';
import { hasActivePlan } from '../services/clientPlanService.js';
import {
  isStorageConfigured,
  uploadObject,
  getSignedDownloadUrl,
  deleteObject,
  SIGNED_URL_TTL_SECONDS
} from '../services/storageService.js';
import { detectFileType } from '../utils/fileType.js';

const PLAN_EXPIRED_MESSAGE = 'Tu plan venció o no tienes un plan activo. Contacta a Prime F&H para renovar antes de subir archivos.';
const NOT_FOUND = { success: false, message: 'Recurso no encontrado' };

// Antes de recibir el archivo (y gastar memoria del servidor en él): el paciente
// solo puede subir con plan activo. El staff no tiene esta restricción.
export const requireActivePlanToUpload = async (req, res, next) => {
  try {
    if (req.user.role === 'patient' && !(await hasActivePlan(req.user._id))) {
      return res.status(403).json({
        success: false,
        message: PLAN_EXPIRED_MESSAGE,
        code: 'NO_ACTIVE_PLAN_SESSIONS'
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

// multer entrega los nombres como latin1; se reinterpretan como UTF-8 para
// conservar tildes y ñ ("Resonancia rodilla.pdf", "Exámen.pdf").
const decodeOriginalName = (name = '') => Buffer.from(name, 'latin1').toString('utf8');

// @desc    Subir un archivo médico de un paciente
// @route   POST /api/files/patient/:patientId
// @access  Private (pertenencia verificada en la ruta)
export const uploadFile = async (req, res) => {
  try {
    if (!isStorageConfigured()) {
      return res.status(503).json({ success: false, message: 'El almacenamiento de archivos no está disponible por ahora' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Debes adjuntar un archivo' });
    }

    const patient = await User.findById(req.params.patientId).select('role');
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json(NOT_FOUND);
    }

    // El tipo se decide por el contenido real del archivo, nunca por su extensión
    const detected = detectFileType(req.file.buffer);
    if (!detected) {
      return res.status(400).json({
        success: false,
        message: 'Formato no permitido. Solo se aceptan archivos PDF, JPG o PNG'
      });
    }

    const rawName = (req.body.fileName || decodeOriginalName(req.file.originalname) || 'archivo').trim();
    const fileName = rawName.slice(0, 200);
    const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 500) : undefined;

    const storageKey = `patients/${patient._id}/${crypto.randomUUID()}.${detected.ext}`;

    await uploadObject(storageKey, req.file.buffer, detected.mimeType);

    let file;
    try {
      file = await ClientFile.create({
        patient: patient._id,
        uploadedBy: req.user._id,
        fileName,
        storageKey,
        mimeType: detected.mimeType,
        sizeBytes: req.file.size,
        description
      });
    } catch (dbError) {
      // Si no se pudo anotar en la base, no dejar un archivo huérfano en R2
      await deleteObject(storageKey).catch(() => {});
      throw dbError;
    }

    res.status(201).json({
      success: true,
      data: {
        id: file._id,
        patient: file.patient,
        uploadedBy: file.uploadedBy,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        description: file.description,
        createdAt: file.createdAt
      }
    });
  } catch (error) {
    console.error('Error al subir archivo:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo subir el archivo' });
  }
};

// @desc    Listar los archivos de un paciente
// @route   GET /api/files/patient/:patientId
// @access  Private (pertenencia verificada en la ruta)
export const getPatientFiles = async (req, res) => {
  try {
    const files = await ClientFile.find({ patient: req.params.patientId })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'firstName lastName role');

    res.json({ success: true, count: files.length, data: files });
  } catch (error) {
    console.error('Error al listar archivos:', error.message);
    res.status(500).json({ success: false, message: 'No se pudieron cargar los archivos' });
  }
};

// @desc    Obtener una URL firmada (5 min) para ver/descargar un archivo
// @route   GET /api/files/:id/download
// @access  Private (pertenencia al paciente dueño del archivo)
export const getDownloadUrl = async (req, res) => {
  try {
    const file = await ClientFile.findById(req.params.id).select('+storageKey');
    if (!file || !(await canAccessPatient(req.user, file.patient))) {
      return res.status(404).json(NOT_FOUND);
    }

    const url = await getSignedDownloadUrl(file.storageKey, {
      fileName: file.fileName,
      contentType: file.mimeType
    });

    res.json({
      success: true,
      data: { url, expiresIn: SIGNED_URL_TTL_SECONDS, fileName: file.fileName, mimeType: file.mimeType }
    });
  } catch (error) {
    console.error('Error al generar URL de descarga:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo generar el enlace de descarga' });
  }
};

// @desc    Eliminar un archivo (quien lo subió, o un admin)
// @route   DELETE /api/files/:id
// @access  Private
export const deleteFile = async (req, res) => {
  try {
    const file = await ClientFile.findById(req.params.id).select('+storageKey');
    if (!file || !(await canAccessPatient(req.user, file.patient))) {
      return res.status(404).json(NOT_FOUND);
    }

    const isUploader = file.uploadedBy.toString() === req.user._id.toString();
    if (req.user.role !== 'admin' && !isUploader) {
      return res.status(403).json({
        success: false,
        message: 'Solo quien subió el archivo o un administrador puede eliminarlo'
      });
    }

    // Primero R2: si falla, el registro queda y se puede reintentar (no se pierde el rastro)
    await deleteObject(file.storageKey);
    await file.deleteOne();

    res.json({ success: true, message: 'Archivo eliminado' });
  } catch (error) {
    console.error('Error al eliminar archivo:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo eliminar el archivo' });
  }
};
