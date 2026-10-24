import mongoose from 'mongoose';

// Un indicador de un objetivo: QUÉ se mide, desde dónde empezó y hasta dónde quiere llegar. No guarda los registros:
// el progreso se calcula siempre desde las mediciones, ejercicios y registros de dolor que ya existen.
const indicatorSchema = new mongoose.Schema({
  indicatorId: { type: String, required: true }, // id estable del catálogo
  label: { type: String, required: true }, // texto mostrado al crearlo (el id es lo que manda)
  source: { type: String, required: true },
  unit: { type: String, required: true },
  params: { type: mongoose.Schema.Types.Mixed, default: {} }, // ejercicio, carga, lado, zona… ya validados contra el catálogo
  seriesKey: { type: String, required: true },
  direction: { type: String, enum: ['increase', 'decrease', 'maintain'], required: true },
  origin: { type: String, enum: ['registro', 'autorreporte', 'profesional'], default: 'registro' },
  baseline: { value: Number, day: String, refId: String }, // punto de partida real (puede quedar vacío hasta el primer registro)
  target: { value: Number, tolerance: Number },
  targetSetBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetSetByRole: { type: String, enum: ['patient', 'professional', 'admin'] },
  achievedAt: Date // cuándo se confirmó este indicador (no se borra aunque un registro posterior cambie)
}, { _id: false });

// Historial de cambios: solo se AGREGA. Una meta nunca se pisa en silencio.
const historySchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  byRole: { type: String, enum: ['patient', 'professional', 'admin', 'system'] },
  action: {
    type: String,
    enum: ['created', 'validated', 'target_changed', 'paused', 'resumed', 'discarded', 'achieved', 'submitted_for_validation', 'baseline_set'],
    required: true
  },
  note: { type: String, trim: true, maxlength: 300 },
  changes: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const patientGoalSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  categoryId: { type: String, required: true }, // id estable de la categoría
  catalogVersion: { type: Number, required: true },
  // Cupo: 1 = principal, 2 y 3 = secundarios. Solo lo tienen los objetivos activos o pendientes de validación;
  // el índice único impide, aunque dos pedidos lleguen a la vez, tener dos principales o más de tres activos.
  slot: { type: Number, enum: [1, 2, 3] },
  status: { type: String, enum: ['pending_validation', 'active', 'paused', 'achieved', 'discarded'], required: true },
  indicators: { type: [indicatorSchema], validate: [(v) => v.length >= 1 && v.length <= 5, 'Un objetivo tiene entre 1 y 5 indicadores'] },
  requiresValidation: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByRole: { type: String, enum: ['patient', 'professional', 'admin'], required: true },
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  validatedAt: Date,
  startedAt: { type: Date, default: Date.now },
  targetDay: String, // fecha objetivo opcional 'AAAA-MM-DD'
  achievedAt: Date,
  pausedAt: Date,
  discardedAt: Date,
  discardReason: { type: String, trim: true, maxlength: 300 },
  celebrate: { type: Boolean, default: true }, // las celebraciones se pueden desactivar
  reminders: { type: Boolean, default: true }, // recordatorios dentro de la app
  history: { type: [historySchema], default: [] }
}, { timestamps: true });

patientGoalSchema.index({ patient: 1, status: 1 });
// Un cupo por paciente: protege contra pedidos simultáneos
patientGoalSchema.index({ patient: 1, slot: 1 }, { unique: true, partialFilterExpression: { slot: { $exists: true } } });

export default mongoose.model('PatientGoal', patientGoalSchema);
