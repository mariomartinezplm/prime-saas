import mongoose from 'mongoose';

// Un logro CONCEDIDO a un paciente. Las definiciones (nombre, criterio, reglas) viven en
// config/achievements.js; aquí solo queda el hecho de que se ganó, cuándo y con qué evidencia.
//
// El índice único (paciente + logro + periodo) es lo que garantiza que un mismo logro no se conceda dos veces,
// aunque el mismo evento llegue repetido, se recargue la página o dos procesos lo evalúen a la vez.
const achievementAwardSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El paciente es requerido']
  },
  // Clave del catálogo, p. ej. 'kine_5' o 'consistency_month'
  key: {
    type: String,
    required: [true, 'La clave del logro es requerida'],
    trim: true
  },
  // 'once' para logros que se ganan una sola vez; 'YYYY-MM' para los mensuales
  periodKey: {
    type: String,
    default: 'once',
    trim: true
  },
  category: {
    type: String,
    required: [true, 'La categoría es requerida']
  },
  // Versión de la regla con la que se evaluó: si el criterio cambia en el futuro, los logros ya ganados
  // conservan la versión con la que se concedieron.
  ruleVersion: {
    type: Number,
    default: 1
  },
  awardedAt: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    enum: ['auto', 'manual'],
    default: 'auto'
  },
  // Solo en reconocimientos manuales: quién lo concedió y por qué (queda registrado)
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reason: {
    type: String,
    trim: true
  },
  // Qué datos reales justifican el logro (para que el profesional pueda verlos y revisarlos)
  evidence: {
    // Ids de los registros que lo respaldan (citas, mediciones, check-ins…)
    refs: [{ type: mongoose.Schema.Types.ObjectId }],
    refModel: { type: String },
    // Cifras que se usaron (p. ej. { completed: 5, target: 5 })
    values: { type: mongoose.Schema.Types.Mixed },
    // Texto corto y SIN datos clínicos sensibles
    summary: { type: String, trim: true }
  },
  // 'under_review': un registro que lo respaldaba se corrigió después. El logro NO se retira en silencio:
  // queda marcado para que el profesional lo revise.
  status: {
    type: String,
    enum: ['active', 'under_review'],
    default: 'active'
  },
  reviewNote: {
    type: String,
    trim: true
  },
  reviewFlaggedAt: {
    type: Date
  },
  // Cuándo vio la persona la animación de desbloqueo (guardado en el servidor: no se repite al recargar
  // ni en otro dispositivo)
  seenAt: {
    type: Date
  }
}, {
  timestamps: true
});

achievementAwardSchema.index({ patient: 1, key: 1, periodKey: 1 }, { unique: true });
achievementAwardSchema.index({ patient: 1, awardedAt: -1 });
achievementAwardSchema.index({ patient: 1, seenAt: 1 });

const AchievementAward = mongoose.model('AchievementAward', achievementAwardSchema);

export default AchievementAward;
