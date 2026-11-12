import mongoose from 'mongoose';
import { IMPLEMENTS } from '../services/exerciseAttributes.js';

// «Preparar entrenamiento»: lo que el profesional PLANIFICA para la próxima sesión de un paciente. Es una colección aparte de
// ExerciseProgress a propósito: una preparación NO es una sesión realizada. No marca asistencia, no descuenta sesiones, no toca pagos
// ni cupos, no crea registros de ejercicio y no genera récords ni entra en los gráficos. Solo se vuelve «realizado» cuando alguien
// registra lo que de verdad hizo (entrenamiento en curso o formulario de Ejercicios).
const groupSchema = new mongoose.Schema(
  {
    sets: { type: Number, required: true, min: 1, max: 20 },
    reps: { type: Number, min: 1, max: 999 },
    // Carga prevista (puede quedar «por definir»). Con dos mancuernas es la de CADA una, igual que en los registros.
    weight: { type: Number, min: 0, max: 1000 },
    durationSec: { type: Number, min: 1, max: 7200 }
  },
  { _id: false }
);

const slotSchema = new mongoose.Schema(
  {
    exerciseName: { type: String, required: true, trim: true, maxlength: 60 },
    modality: { type: String, enum: ['weight', 'bodyweight', 'time', 'weight_time'], default: 'weight' },
    execution: { type: String, enum: ['normal', 'eccentric', 'isometric'] },
    eccentricSec: { type: Number, min: 1, max: 30 },
    implement: { type: String, enum: IMPLEMENTS },
    // Indicación para el paciente (se ve junto al ejercicio si la preparación es visible)
    note: { type: String, trim: true, maxlength: 200 },
    groups: { type: [groupSchema], default: [] }
  },
  { _id: false }
);

const blockSchema = new mongoose.Schema(
  {
    blockId: { type: String, required: true, maxlength: 60 },
    kind: { type: String, enum: ['single', 'super', 'tri'], required: true },
    slots: { type: [slotSchema], default: [] }
  },
  { _id: false }
);

const trainingPlanSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Día de la sesión para la que se prepara (AAAA-MM-DD, hora de Chile)
    forDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    title: { type: String, trim: true, maxlength: 80 },
    blocks: { type: [blockSchema], default: [] },
    // Si es false el paciente no la ve (queda solo para el equipo)
    visibleToPatient: { type: Boolean, default: true },
    // Notas internas del profesional: NUNCA se envían al paciente
    internalNotes: { type: String, trim: true, maxlength: 1000 },
    // Idempotencia: reintentar el mismo guardado no duplica la preparación
    clientId: { type: String, trim: true, maxlength: 80 }
  },
  { timestamps: true }
);

trainingPlanSchema.index({ patient: 1, forDate: -1, createdAt: -1 });
trainingPlanSchema.index({ patient: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } }, name: 'preparacion_idempotente' });

export default mongoose.model('TrainingPlan', trainingPlanSchema);
