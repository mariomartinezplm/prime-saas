import mongoose from 'mongoose';
import { addHours, isBefore, parseISO } from 'date-fns';

const appointmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El paciente es requerido']
  },
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El profesional es requerido']
  },
  date: {
    type: Date,
    required: [true, 'La fecha es requerida']
  },
  startTime: {
    type: String,
    required: [true, 'La hora de inicio es requerida'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
  },
  endTime: {
    type: String,
    required: [true, 'La hora de fin es requerida'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  type: {
    type: String,
    enum: ['kinesiologia', 'entrenamiento', 'evaluacion'],
    required: [true, 'El tipo de sesión es requerido']
  },
  notes: {
    type: String,
    trim: true
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: {
    type: Date
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  sessionNotes: {
    // Notas del profesional después de la sesión
    type: String,
    trim: true
  },
  exercisesPerformed: [{
    exercise: String,
    sets: Number,
    reps: Number,
    weight: Number,
    notes: String
  }]
}, {
  timestamps: true
});

// Índices para mejorar el rendimiento de las consultas
appointmentSchema.index({ patient: 1, date: 1 });
appointmentSchema.index({ professional: 1, date: 1 });
appointmentSchema.index({ date: 1, status: 1 });

// Validación personalizada: no permitir reservas en el pasado (excepto admin)
appointmentSchema.pre('save', function(next) {
  if (this.isNew && this.status === 'scheduled') {
    const appointmentDateTime = new Date(`${this.date.toISOString().split('T')[0]}T${this.startTime}`);
    const now = new Date();

    if (isBefore(appointmentDateTime, now)) {
      return next(new Error('No se pueden crear citas en el pasado'));
    }
  }
  next();
});

// Método para verificar si la cita puede ser cancelada
appointmentSchema.methods.canBeCancelled = function() {
  const appointmentDateTime = new Date(`${this.date.toISOString().split('T')[0]}T${this.startTime}`);
  const now = new Date();
  const fourHoursFromNow = addHours(now, 4);

  // Debe ser al menos 4 horas antes de la cita
  return isBefore(fourHoursFromNow, appointmentDateTime) && this.status === 'scheduled';
};

// Virtual para obtener la fecha y hora completa
appointmentSchema.virtual('fullDateTime').get(function() {
  return new Date(`${this.date.toISOString().split('T')[0]}T${this.startTime}`);
});

appointmentSchema.set('toJSON', { virtuals: true });
appointmentSchema.set('toObject', { virtuals: true });

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
