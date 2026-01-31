import mongoose from 'mongoose';

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
  }
}, {
  timestamps: true
});

// Índices para mejorar el rendimiento
exerciseProgressSchema.index({ patient: 1, exerciseName: 1, date: -1 });
exerciseProgressSchema.index({ patient: 1, category: 1 });

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
    exerciseName: new RegExp(exerciseName, 'i')
  })
  .sort({ date: -1 })
  .limit(limit)
  .populate('recordedBy', 'firstName lastName');
};

// Método estático para obtener el mejor registro (PR - Personal Record)
exerciseProgressSchema.statics.getPersonalRecord = async function(patientId, exerciseName) {
  return await this.findOne({
    patient: patientId,
    exerciseName: new RegExp(exerciseName, 'i'),
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
