import mongoose from 'mongoose';

export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const clientFileSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El paciente es requerido']
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Quien sube el archivo es requerido']
  },
  fileName: {
    type: String,
    required: [true, 'El nombre del archivo es requerido'],
    trim: true,
    maxlength: [200, 'El nombre no puede superar 200 caracteres']
  },
  // Clave del objeto dentro del bucket privado de R2. Nunca es una URL: el
  // acceso es solo con URLs firmadas que vencen a los 5 minutos.
  storageKey: {
    type: String,
    required: true,
    select: false
  },
  mimeType: {
    type: String,
    required: true,
    enum: ALLOWED_MIME_TYPES
  },
  sizeBytes: {
    type: Number,
    required: true,
    min: 1,
    max: MAX_FILE_SIZE_BYTES
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La descripción no puede superar 500 caracteres']
  }
}, {
  timestamps: true
});

clientFileSchema.index({ patient: 1, createdAt: -1 });

const ClientFile = mongoose.model('ClientFile', clientFileSchema);

export default ClientFile;
