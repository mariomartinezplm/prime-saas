import crypto from 'crypto';
import User from '../models/User.js';
import { isStorageConfigured, uploadObject, getObjectBuffer, deleteObject } from '../services/storageService.js';
import { detectFileType } from '../utils/fileType.js';
import { sanitizeJpeg, JpegError } from '../utils/jpegSanitize.js';

// Foto de perfil de la PROPIA persona (cualquier rol). Nunca recibe un id: siempre es la cuenta autenticada, así nadie puede cambiar
// ni leer la foto de otra cuenta por este camino. El archivo es privado en R2 y se entrega por esta misma API, con sesión.

export const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const STORAGE_DOWN = { success: false, message: 'El almacenamiento de archivos no está disponible por ahora' };

const etagOf = (date) => `"${new Date(date).getTime()}"`;

// @desc    Subir o cambiar la foto de perfil
// @route   PUT /api/avatar
// @access  Private
export const uploadAvatar = async (req, res) => {
  try {
    if (!isStorageConfigured()) return res.status(503).json(STORAGE_DOWN);
    if (!req.file) return res.status(400).json({ success: false, message: 'Debes adjuntar una foto' });

    // El tipo se decide por el contenido real, nunca por el nombre ni por el Content-Type que declare quien sube
    const detected = detectFileType(req.file.buffer);
    if (!detected || detected.mimeType !== 'image/jpeg') {
      return res.status(400).json({ success: false, message: 'Formato no permitido. Elige una foto JPG, PNG o WebP' });
    }

    let clean;
    try {
      clean = sanitizeJpeg(req.file.buffer);
    } catch (error) {
      if (error instanceof JpegError) return res.status(400).json({ success: false, message: `${error.message}. Prueba con otra foto` });
      throw error;
    }

    const current = await User.findById(req.user._id).select('+avatarKey');
    if (!current) return res.status(404).json({ success: false, message: 'Recurso no encontrado' });

    const storageKey = `avatars/${current._id}/${crypto.randomUUID()}.jpg`;
    await uploadObject(storageKey, clean.buffer, 'image/jpeg');

    const avatarUpdatedAt = new Date();
    try {
      await User.updateOne({ _id: current._id }, { $set: { avatarKey: storageKey, avatarUpdatedAt } });
    } catch (dbError) {
      // Si no se pudo anotar en la base, no dejar una foto huérfana en R2
      await deleteObject(storageKey).catch(() => {});
      throw dbError;
    }

    // La foto anterior ya no sirve: se borra para no acumular archivos de una persona
    if (current.avatarKey) await deleteObject(current.avatarKey).catch((error) => console.error('Error borrando la foto anterior:', error.message));

    res.status(200).json({ success: true, message: 'Foto actualizada', data: { avatarUpdatedAt } });
  } catch (error) {
    console.error('Error al subir la foto de perfil:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo guardar la foto. Inténtalo de nuevo' });
  }
};

// @desc    Ver la propia foto de perfil
// @route   GET /api/avatar
// @access  Private
export const getAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+avatarKey avatarUpdatedAt');
    if (!user?.avatarKey || !user.avatarUpdatedAt) return res.status(404).json({ success: false, message: 'Sin foto de perfil' });

    // Se revalida siempre (barato: 304 si no cambió); así nunca se ve una foto antigua después de cambiarla
    const etag = etagOf(user.avatarUpdatedAt);
    res.set({ ETag: etag, 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff' });
    if (req.headers['if-none-match'] === etag) return res.status(304).end();

    if (!isStorageConfigured()) return res.status(503).json(STORAGE_DOWN);
    const bytes = await getObjectBuffer(user.avatarKey);
    res.type('image/jpeg').send(bytes);
  } catch (error) {
    console.error('Error al leer la foto de perfil:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo cargar la foto' });
  }
};

// @desc    Quitar la foto de perfil (vuelven las iniciales)
// @route   DELETE /api/avatar
// @access  Private
export const deleteAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+avatarKey');
    if (!user) return res.status(404).json({ success: false, message: 'Recurso no encontrado' });

    await User.updateOne({ _id: user._id }, { $unset: { avatarKey: 1, avatarUpdatedAt: 1 } });
    if (user.avatarKey && isStorageConfigured()) await deleteObject(user.avatarKey).catch((error) => console.error('Error borrando la foto:', error.message));

    res.status(200).json({ success: true, message: 'Foto quitada' });
  } catch (error) {
    console.error('Error al quitar la foto de perfil:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo quitar la foto' });
  }
};
