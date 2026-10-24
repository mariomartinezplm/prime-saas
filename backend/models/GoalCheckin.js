import mongoose from 'mongoose';

// Registro MANUAL de un indicador que el centro todavía no mide por otro lado (estrés, horas de sueño, actividad
// declarada, grados de movimiento, presión, etc.). Siempre queda identificado como autorreporte o como registro del
// profesional: un dato declarado nunca se presenta como una medición validada.
const goalCheckinSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seriesKey: { type: String, required: true }, // misma clave que el indicador del objetivo
  indicatorId: { type: String, required: true },
  value: { type: Number, required: true },
  unit: { type: String, required: true },
  day: { type: String, required: true }, // 'AAAA-MM-DD' en hora de Chile
  source: { type: String, enum: ['self_report', 'professional'], required: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String, trim: true, maxlength: 300 },
  // Idempotencia: reintentar el mismo envío nunca duplica el registro
  clientId: { type: String, trim: true, maxlength: 80 }
}, { timestamps: true });

goalCheckinSchema.index({ patient: 1, seriesKey: 1, day: 1 });
goalCheckinSchema.index({ patient: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } });

export default mongoose.model('GoalCheckin', goalCheckinSchema);
