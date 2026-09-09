import mongoose from 'mongoose';
import { isBefore } from 'date-fns';
import { nowInSantiago } from '../utils/timezone.js';

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
  }],
  // Motor de descuento de sesiones (Paso 15 de BLUEPRINT.md). Se descuenta al
  // AGENDAR, no al completar — sessionDeducted es lo que le dice a
  // cancelAppointment si hay algo que devolver, y de dónde vino (deduction),
  // sin tener que volver a calcular nada.
  sessionDeducted: {
    type: Boolean,
    default: false
  },
  deduction: {
    source: { type: String, enum: ['clientPlan', 'extraSession'] },
    refId: { type: mongoose.Schema.Types.ObjectId }
  }
}, {
  timestamps: true
});

// Índices para mejorar el rendimiento de las consultas
appointmentSchema.index({ patient: 1, date: 1 });
appointmentSchema.index({ professional: 1, date: 1 });
appointmentSchema.index({ date: 1, status: 1 });

// Validación personalizada: no permitir reservas en el pasado (excepto admin).
// Compara contra la hora real de Santiago, no la del servidor (Paso 17 de
// BLUEPRINT.md) — el servidor corre en UTC, así que `new Date()` directo
// desfasaba esta regla varias horas respecto a la hora real de Chile.
appointmentSchema.pre('save', function (next) {
  if (this.isNew && this.status === 'scheduled') {
    const appointmentDateTime = new Date(`${this.date.toISOString().split('T')[0]}T${this.startTime}`);

    if (isBefore(appointmentDateTime, nowInSantiago())) {
      return next(new Error('No se pueden crear citas en el pasado'));
    }
  }
  next();
});

// Virtual para obtener la fecha y hora completa
appointmentSchema.virtual('fullDateTime').get(function () {
  return new Date(`${this.date.toISOString().split('T')[0]}T${this.startTime}`);
});

appointmentSchema.set('toJSON', { virtuals: true });
appointmentSchema.set('toObject', { virtuals: true });

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
