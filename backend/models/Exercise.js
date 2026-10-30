import mongoose from 'mongoose';
import { escapeRegex } from '../middleware/sanitize.js';
import { exerciseKey } from '../utils/exerciseKey.js';

const exerciseProgressSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El paciente es requerido']
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El profesional que registra es requerido']
  },
  exerciseName: {
    type: String,
    required: [true, 'El nombre del ejercicio es requerido'],
    trim: true
  },
  // Identidad canónica (se calcula sola desde el nombre): agrupa «Press Banca», «press banca» y «PRESS BANCA».
  // Los registros anteriores a este campo se agrupan igual calculando la clave al leerlos.
  exerciseKey: { type: String, index: true },
  // Solo si una normalización autorizada unificó la escritura: el nombre original se conserva aquí
  exerciseNameOriginal: { type: String, trim: true },
  category: {
    type: String,
    enum: ['fuerza', 'cardio', 'flexibilidad', 'funcional', 'rehabilitacion', 'otro'],
    default: 'fuerza'
  },
  date: {
    type: Date,
    required: [true, 'La fecha es requerida'],
    default: Date.now
  },
  // Para ejercicios de fuerza
  sets: {
    type: Number,
    min: [0, 'Las series deben ser un número positivo']
  },
  reps: {
    type: Number,
    min: [0, 'Las repeticiones deben ser un número positivo']
  },
  weight: {
    type: Number,
    min: [0, 'El peso debe ser un número positivo']
  },
  weightUnit: {
    type: String,
    enum: ['kg', 'lbs'],
    default: 'kg'
  },
  // Para ejercicios de cardio
  duration: {
    type: Number, // en minutos
    min: [0, 'La duración debe ser un número positivo']
  },
  distance: {
    type: Number, // en metros o kilómetros
    min: [0, 'La distancia debe ser un número positivo']
  },
  distanceUnit: {
    type: String,
    enum: ['m', 'km', 'mi'],
    default: 'km'
  },
  // Intensidad percibida (escala RPE 1-10)
  rpe: {
    type: Number,
    min: [1, 'RPE debe estar entre 1 y 10'],
    max: [10, 'RPE debe estar entre 1 y 10']
  },
  // Notas adicionales
  notes: {
    type: String,
    trim: true
  },
  // Técnica y forma
  techniqueRating: {
    type: Number,
    min: [1, 'La calificación debe estar entre 1 y 5'],
    max: [5, 'La calificación debe estar entre 1 y 5']
  },
  // Video de referencia (URL)
  videoUrl: {
    type: String,
    trim: true
  },
  // 1RM calculado (para ejercicios de fuerza)
  oneRepMax: {
    type: Number
  },

  // ── Procedencia: serie registrada desde «Entrenamiento en curso» (todo opcional; los registros históricos no lo tienen) ──
  source: { type: String, enum: ['workout'] },
  workoutSession: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutSession', index: true },
  blockId: { type: String, trim: true, maxlength: 60 },
  blockKind: { type: String, enum: ['single', 'super', 'tri'] },
  // Posición dentro del bloque (A1, A2, B3…): conserva la identidad individual del ejercicio dentro de una superserie
  slot: { type: String, trim: true, maxlength: 10 },
  setNumber: { type: Number, min: 1, max: 99 },
  // Con peso externo, peso corporal, por tiempo, o con peso y tiempo a la vez (isométrico con carga). No se convierten entre sí.
  modality: { type: String, enum: ['weight', 'bodyweight', 'time', 'weight_time'] },
  // Segundos de un ejercicio por tiempo (`duration` sigue siendo minutos, como siempre)
  durationSec: { type: Number, min: 1, max: 7200 },
  // Clave de idempotencia de esta serie: reintentar el mismo envío nunca la duplica
  clientId: { type: String, trim: true, maxlength: 80 }
}, {
  timestamps: true
});

// Índices para mejorar el rendimiento
exerciseProgressSchema.index({ patient: 1, exerciseName: 1, date: -1 });
exerciseProgressSchema.index({ patient: 1, category: 1 });
exerciseProgressSchema.index({ patient: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } }, name: 'serie_idempotente' });

// La clave canónica siempre sigue al nombre (al crear o al corregirlo)
exerciseProgressSchema.pre('validate', function(next) {
  if (this.exerciseName) this.exerciseKey = exerciseKey(this.exerciseName);
  next();
});

// Calcular 1RM aproximado usando la fórmula de Epley antes de guardar
exerciseProgressSchema.pre('save', function(next) {
  if (this.weight && this.reps && this.reps > 0 && this.reps <= 12) {
    // Fórmula de Epley: 1RM = weight × (1 + reps/30)
    this.oneRepMax = parseFloat((this.weight * (1 + this.reps / 30)).toFixed(2));
  }
  next();
});

// Método estático para obtener el progreso de un ejercicio específico
exerciseProgressSchema.statics.getExerciseProgress = async function(patientId, exerciseName, limit = 10) {
  return await this.find({
    patient: patientId,
    exerciseName: new RegExp(escapeRegex(exerciseName), 'i')
  })
  .sort({ date: -1 })
  .limit(limit)
  .populate('recordedBy', 'firstName lastName');
};

// Método estático para obtener el mejor registro (PR - Personal Record)
exerciseProgressSchema.statics.getPersonalRecord = async function(patientId, exerciseName) {
  return await this.findOne({
    patient: patientId,
    exerciseName: new RegExp(escapeRegex(exerciseName), 'i'),
    weight: { $exists: true, $gt: 0 }
  })
  .sort({ oneRepMax: -1, weight: -1 })
  .limit(1);
};

// Método estático para obtener todos los ejercicios únicos de un paciente
exerciseProgressSchema.statics.getUniqueExercises = async function(patientId) {
  return await this.distinct('exerciseName', { patient: patientId });
};

const ExerciseProgress = mongoose.model('ExerciseProgress', exerciseProgressSchema);

export default ExerciseProgress;
