import mongoose from 'mongoose';

// Las 5 respuestas se guardan siempre en la misma dirección: 1 = mal, 9 = bien (la
// pantalla invierte fatiga, dolor y estrés antes de enviarlas). `energy` guarda
// lo contrario de la fatiga. Los check-ins anteriores al 2026-10-03 están en escala
// 1-5 y NO tienen `scale`: utils/readiness.js los convierte al leerlos. Por eso
// `scale` no tiene valor por defecto: un default haría que se leyeran como 9.
const wellnessCheckinSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El paciente es requerido']
  },
  // "YYYY-MM-DD" en hora de Santiago (Paso 17: nowInSantiago), no la del
  // servidor — así el índice único por día coincide con el día real del
  // paciente en Chile, no con UTC.
  date: {
    type: String,
    required: [true, 'La fecha es requerida']
  },
  scale: { type: Number, enum: [5, 9] },
  sleep: { type: Number, required: true, min: 1, max: 9 },
  energy: { type: Number, required: true, min: 1, max: 9 },
  stress: { type: Number, required: true, min: 1, max: 9 },
  soreness: { type: Number, required: true, min: 1, max: 9 },
  mood: { type: Number, required: true, min: 1, max: 9 },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// 1 check-in por paciente por día garantizado por la base de datos, no solo
// por el frontend (Paso 23 de BLUEPRINT.md).
wellnessCheckinSchema.index({ patient: 1, date: 1 }, { unique: true });

const WellnessCheckin = mongoose.model('WellnessCheckin', wellnessCheckinSchema);

export default WellnessCheckin;
