import mongoose from 'mongoose';
import { SERVICE_TYPES } from '../config/planCatalog.js';

const extraSessionSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El paciente es requerido']
  },
  serviceType: {
    type: String,
    enum: SERVICE_TYPES,
    required: [true, 'El tipo de servicio es requerido']
  },
  // Profesional (o admin) que otorga la sesión extra
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Quién otorga la sesión extra es requerido']
  },
  reason: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  // Se marca true cuando la sesión extra ya fue consumida (ej. al agendar/completar una cita)
  used: {
    type: Boolean,
    default: false
  },
  usedAt: {
    type: Date
  },
  usedInAppointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  }
}, {
  timestamps: true
});

extraSessionSchema.index({ patient: 1, used: 1 });

const ExtraSession = mongoose.model('ExtraSession', extraSessionSchema);

export default ExtraSession;
