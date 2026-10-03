import mongoose from 'mongoose';

export const PHOTO_POSITIONS = ['front', 'back', 'side-left', 'side-right', 'other'];
export const PHOTO_VISIBILITIES = ['shared', 'private'];
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png'];
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

const progressPhotoSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El paciente es requerido']
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Quien sube la foto es requerido']
  },
  // Clave del objeto en el bucket privado de R2. Nunca es una URL: el acceso es
  // solo con URLs firmadas y temporales.
  storageKey: {
    type: String,
    required: true,
    select: false
  },
  mimeType: {
    type: String,
    required: true,
    enum: PHOTO_MIME_TYPES
  },
  sizeBytes: {
    type: Number,
    required: true,
    min: 1,
    max: MAX_PHOTO_SIZE_BYTES
  },
  position: {
    type: String,
    enum: PHOTO_POSITIONS,
    default: 'front'
  },
  // Fecha en que se tomó la foto (para ordenarla y compararla), no la de subida
  takenAt: {
    type: Date,
    default: Date.now
  },
  // shared: el paciente, su profesional asignado y el admin.
  // private ("solo yo"): únicamente quien la sube y el admin; NUNCA el profesional asignado.
  visibility: {
    type: String,
    enum: PHOTO_VISIBILITIES,
    default: 'shared'
  },
  note: {
    type: String,
    trim: true,
    maxlength: [300, 'La nota no puede superar 300 caracteres']
  }
}, {
  timestamps: true
});

progressPhotoSchema.index({ patient: 1, takenAt: -1 });

const ProgressPhoto = mongoose.model('ProgressPhoto', progressPhotoSchema);

export default ProgressPhoto;
