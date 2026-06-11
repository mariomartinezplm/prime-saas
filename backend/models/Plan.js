import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
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
  // Tipo de plan: kinesiología (10 sesiones), entrenamiento 2x o 3x por semana
  planType: {
    type: String,
    enum: ['kinesiologia', 'entrenamiento-2x', 'entrenamiento-3x'],
    required: [true, 'El tipo de plan es requerido']
  },
  // Duración del plan
  duration: {
    type: String,
    enum: ['mensual', 'trimestral', 'semestral', 'anual'],
    default: 'mensual'
  },
  // Sesiones por semana (auto-calculado según planType)
  sessionsPerWeek: {
    type: Number,
    default: 2
  },
  // Sesiones por mes (auto-calculado según planType)
  sessionsPerMonth: {
    type: Number,
    default: 8
  },
  // Solo para kinesiología: total de sesiones del bono
  totalSessions: {
    type: Number,
    default: 10 // Bono de 10 sesiones para kinesiología
  },
  // Sesiones usadas (para kinesiología)
  sessionsUsed: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date,
    required: [true, 'La fecha de inicio es requerida']
  },
  endDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'completed'],
    default: 'active'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

planSchema.index({ patient: 1, status: 1 });
planSchema.index({ patient: 1, startDate: 1, endDate: 1 });

// Auto-configurar según tipo de plan
planSchema.pre('validate', function (next) {
  // Configurar sessionsPerWeek y sessionsPerMonth según planType
  if (this.planType === 'kinesiologia') {
    // Kine: sin límite semanal, solo 10 sesiones totales
    this.sessionsPerWeek = 7; // puede agendar cualquier día
    this.sessionsPerMonth = 10; // máximo 10 sesiones totales (no mensual)
    this.totalSessions = this.totalSessions || 10;
  } else if (this.planType === 'entrenamiento-2x') {
    this.sessionsPerWeek = 2;
    this.sessionsPerMonth = 8; // 2 veces por semana × 4 semanas
    this.totalSessions = 0; // sin límite de total, solo mensual
  } else if (this.planType === 'entrenamiento-3x') {
    this.sessionsPerWeek = 3;
    this.sessionsPerMonth = 12; // 3 veces por semana × 4 semanas
    this.totalSessions = 0;
  }

  // Calcular endDate basado en duración (solo si no existe o cambió)
  if (this.isModified('startDate') || this.isModified('duration')) {
    const start = new Date(this.startDate);

    if (this.planType === 'kinesiologia') {
      // Kine: el plan no expira por tiempo, solo por sesiones
      // Ponemos un endDate lejano (6 meses por defecto)
      this.endDate = new Date(start.setMonth(start.getMonth() + 6));
    } else {
      switch (this.duration) {
        case 'mensual':
          this.endDate = new Date(start.setMonth(start.getMonth() + 1));
          break;
        case 'trimestral':
          this.endDate = new Date(start.setMonth(start.getMonth() + 3));
          break;
        case 'semestral':
          this.endDate = new Date(start.setMonth(start.getMonth() + 6));
          break;
        case 'anual':
          this.endDate = new Date(start.setFullYear(start.getFullYear() + 1));
          break;
      }
    }
  }

  next();
});

// Método: verificar si el plan tiene sesiones disponibles
planSchema.methods.hasAvailableSessions = function () {
  if (this.planType === 'kinesiologia') {
    return this.sessionsUsed < this.totalSessions;
  }
  // Para entrenamiento, no hay límite total, solo semanal
  return true;
};

// Método: obtener sesiones restantes (solo kine)
planSchema.methods.getRemainingKineSessions = function () {
  if (this.planType !== 'kinesiologia') return null;
  return this.totalSessions - this.sessionsUsed;
};

// Virtual: nombre legible del plan
planSchema.virtual('displayName').get(function () {
  switch (this.planType) {
    case 'kinesiologia':
      return `Kinesiología (${this.getRemainingKineSessions()} de ${this.totalSessions} sesiones)`;
    case 'entrenamiento-2x':
      return 'Entrenamiento 2x/semana';
    case 'entrenamiento-3x':
      return 'Entrenamiento 3x/semana';
    default:
      return this.planType;
  }
});

planSchema.set('toJSON', { virtuals: true });
planSchema.set('toObject', { virtuals: true });

const Plan = mongoose.model('Plan', planSchema);

export default Plan;
