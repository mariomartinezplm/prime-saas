import crypto from 'crypto';
import ProgressPhoto, { PHOTO_POSITIONS, PHOTO_VISIBILITIES } from '../models/ProgressPhoto.js';
import User from '../models/User.js';
import { canAccessPatient } from '../middleware/auth.js';
import { hasActivePlan } from '../services/clientPlanService.js';
import { notify } from '../services/notificationService.js';
import {
  isStorageConfigured,
  uploadObject,
  getSignedDownloadUrl,
  deleteObject
} from '../services/storageService.js';
import { detectFileType } from '../utils/fileType.js';
import { evolutionDateError } from '../utils/evolutionDate.js';

// Las URLs de las fotos duran más que las de los archivos (15 min en vez de 5):
// el paciente las mira y compara sin que se rompan a mitad de pantalla.
const PHOTO_URL_TTL_SECONDS = 900;
const MAX_PHOTOS_PER_LIST = 200;
const PLAN_EXPIRED_MESSAGE = 'Tu plan venció o no tienes un plan activo. Contacta a Prime F&H para renovar antes de subir fotos.';
const NOT_FOUND = { success: false, message: 'Recurso no encontrado' };

const idOf = (value) => (value?._id ?? value).toString();

// Regla de visibilidad (decisión de Mario): una foto "solo yo" la ven únicamente
// quien la sube y el admin. El profesional asignado NO la ve, aunque sea su paciente.
export const canSeePhoto = (user, photo) =>
  user.role === 'admin' ||
  photo.visibility === 'shared' ||
  idOf(photo.uploadedBy) === user._id.toString();

// Antes de recibir el archivo: el paciente solo sube con plan activo.
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

const serializePhoto = async (photo) => ({
  id: photo._id,
  patient: photo.patient,
  uploadedBy: photo.uploadedBy,
  position: photo.position,
  takenAt: photo.takenAt,
  visibility: photo.visibility,
  note: photo.note,
  mimeType: photo.mimeType,
  createdAt: photo.createdAt,
  url: await getSignedDownloadUrl(photo.storageKey, { contentType: photo.mimeType, expiresIn: PHOTO_URL_TTL_SECONDS }),
  expiresIn: PHOTO_URL_TTL_SECONDS
});

// @desc    Subir una foto de progreso
// @route   POST /api/photos/patient/:patientId
// @access  Private (pertenencia y plan verificados en la ruta)
export const uploadPhoto = async (req, res) => {
  try {
    if (!isStorageConfigured()) {
      return res.status(503).json({ success: false, message: 'El almacenamiento de archivos no está disponible por ahora' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Debes adjuntar una foto' });
    }

    const patient = await User.findById(req.params.patientId).select('role firstName lastName assignedProfessionalId');
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json(NOT_FOUND);
    }

    // El tipo se decide por el contenido real del archivo, nunca por su extensión
    const detected = detectFileType(req.file.buffer);
    if (!detected || !detected.mimeType.startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'Formato no permitido. Solo se aceptan fotos JPG o PNG' });
    }

    const position = req.body.position || 'front';
    if (!PHOTO_POSITIONS.includes(position)) {
      return res.status(400).json({ success: false, message: 'Posición no válida' });
    }

    const dateError = evolutionDateError(req.body.takenAt);
    if (dateError) {
      return res.status(400).json({ success: false, message: dateError });
    }

    // Solo el paciente elige quién ve su foto. Lo que sube el personal es siempre
    // compartido: una foto "solo yo" del personal quedaría oculta para el propio paciente.
    let visibility = 'shared';
    if (req.user.role === 'patient' && req.body.visibility !== undefined) {
      if (!PHOTO_VISIBILITIES.includes(req.body.visibility)) {
        return res.status(400).json({ success: false, message: 'Visibilidad no válida' });
      }
      visibility = req.body.visibility;
    }

    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 300) : undefined;
    const storageKey = `photos/${patient._id}/${crypto.randomUUID()}.${detected.ext}`;

    await uploadObject(storageKey, req.file.buffer, detected.mimeType);

    let photo;
    try {
      photo = await ProgressPhoto.create({
        patient: patient._id,
        uploadedBy: req.user._id,
        storageKey,
        mimeType: detected.mimeType,
        sizeBytes: req.file.size,
        position,
        takenAt: req.body.takenAt || new Date(),
        visibility,
        note
      });
    } catch (dbError) {
      // Si no se pudo anotar en la base, no dejar una foto huérfana en R2
      await deleteObject(storageKey).catch(() => {});
      throw dbError;
    }

    // Aviso al profesional solo si la foto es compartida: de una privada ni siquiera
    // debe enterarse de que existe.
    if (req.user.role === 'patient' && visibility === 'shared' && patient.assignedProfessionalId) {
      notify(patient.assignedProfessionalId, 'evolution_updated', {
        title: 'Nueva foto de progreso',
        body: `${patient.firstName} ${patient.lastName} subió una foto de progreso.`,
        link: `/app/admin/pacientes/${patient._id}`
      }).catch((error) => {
        console.error('Error al notificar foto al profesional:', error.message);
      });
    }

    res.status(201).json({ success: true, data: { id: photo._id } });
  } catch (error) {
    console.error('Error al subir foto:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo subir la foto' });
  }
};

// @desc    Listar las fotos de un paciente que el usuario puede ver
// @route   GET /api/photos/patient/:patientId
// @access  Private (pertenencia verificada en la ruta)
export const getPatientPhotos = async (req, res) => {
  try {
    if (!isStorageConfigured()) {
      return res.status(503).json({ success: false, message: 'El almacenamiento de archivos no está disponible por ahora' });
    }

    // La visibilidad se aplica en la consulta: una foto privada ajena nunca sale de la base
    const filter = { patient: req.params.patientId };
    if (req.user.role !== 'admin') {
      filter.$or = [{ visibility: 'shared' }, { uploadedBy: req.user._id }];
    }

    const photos = await ProgressPhoto.find(filter)
      .select('+storageKey')
      .sort({ takenAt: -1 })
      .limit(MAX_PHOTOS_PER_LIST)
      .populate('uploadedBy', 'firstName lastName role');

    const data = await Promise.all(photos.map(serializePhoto));
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('Error al listar fotos:', error.message);
    res.status(500).json({ success: false, message: 'No se pudieron cargar las fotos' });
  }
};

// Carga la foto y verifica pertenencia + visibilidad. Devuelve null si el usuario
// no debe ni saber que existe (404, nunca 403).
async function loadVisiblePhoto(req) {
  const photo = await ProgressPhoto.findById(req.params.id).select('+storageKey');
  if (!photo) return null;
  if (!(await canAccessPatient(req.user, photo.patient))) return null;
  if (!canSeePhoto(req.user, photo)) return null;
  return photo;
}

// @desc    Cambiar visibilidad, posición, fecha o nota (solo quien la subió)
// @route   PUT /api/photos/:id
// @access  Private
export const updatePhoto = async (req, res) => {
  try {
    const photo = await loadVisiblePhoto(req);
    if (!photo) return res.status(404).json(NOT_FOUND);

    if (idOf(photo.uploadedBy) !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Solo quien subió la foto puede modificarla' });
    }

    const { visibility, position, takenAt, note } = req.body;

    if (position !== undefined && !PHOTO_POSITIONS.includes(position)) {
      return res.status(400).json({ success: false, message: 'Posición no válida' });
    }
    if (visibility !== undefined && !PHOTO_VISIBILITIES.includes(visibility)) {
      return res.status(400).json({ success: false, message: 'Visibilidad no válida' });
    }
    const dateError = evolutionDateError(takenAt);
    if (dateError) return res.status(400).json({ success: false, message: dateError });

    if (position !== undefined) photo.position = position;
    if (takenAt) photo.takenAt = takenAt;
    if (note !== undefined) photo.note = String(note).trim().slice(0, 300);
    // Igual que al subir: solo el paciente decide la visibilidad
    if (visibility !== undefined && req.user.role === 'patient') photo.visibility = visibility;

    await photo.save();
    res.json({ success: true, data: await serializePhoto(photo) });
  } catch (error) {
    console.error('Error al actualizar foto:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo actualizar la foto' });
  }
};

// @desc    Eliminar una foto (quien la subió, o un admin)
// @route   DELETE /api/photos/:id
// @access  Private
export const deletePhoto = async (req, res) => {
  try {
    const photo = await loadVisiblePhoto(req);
    if (!photo) return res.status(404).json(NOT_FOUND);

    if (req.user.role !== 'admin' && idOf(photo.uploadedBy) !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Solo quien subió la foto o un administrador puede eliminarla' });
    }

    // Primero R2: si falla, el registro queda y se puede reintentar
    await deleteObject(photo.storageKey);
    await photo.deleteOne();

    res.json({ success: true, message: 'Foto eliminada' });
  } catch (error) {
    console.error('Error al eliminar foto:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo eliminar la foto' });
  }
};
