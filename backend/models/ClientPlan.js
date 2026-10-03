import mongoose from 'mongoose';
import {
  PLAN_CATALOG,
  UNLIMITED_AVAILABLE,
  isValidSessionsForServiceType,
  supportsUnlimited
} from '../config/planCatalog.js';
import { TERMS, BILLING_CYCLES, cycleBounds } from '../services/planCycles.js';

const clientPlanSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El paciente es requerido']
  },
  serviceType: {
    type: String,
    enum: Object.keys(PLAN_CATALOG),
    required: [true, 'El tipo de servicio es requerido']
  },
  sessionsTotal: {
    type: Number,
    required: [true, 'El total de sesiones es requerido']
  },
  // Plan ilimitado (solo entrenamiento): sessionsTotal queda en 0 y nunca se
  // agota; sessionsUsed igual sube para llevar la cuenta de asistencia.
  unlimited: {
    type: Boolean,
    default: false
  },
  sessionsUsed: {
    type: Number,
    default: 0,
    min: [0, 'Las sesiones usadas no pueden ser negativas']
  },
  // Fecha del pago
  startDate: {
    type: Date,
    required: [true, 'La fecha de inicio (pago) es requerida'],
    default: Date.now
  },
  // Se calcula automáticamente según billingCycle (ver services/planCycles.js):
  // fin del mes calendario, o de fecha a fecha.
  endDate: {
    type: Date
  },
  // 'upcoming' = ciclo ya pagado que todavía no empieza (planes trimestral/anual)
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'upcoming'],
    default: 'active'
  },
  // Qué se pagó: cada ciclo mensual es su propio registro, así las sesiones
  // parten de cero cada mes y los planes de varios meses no necesitan lógica aparte.
  term: {
    type: String,
    enum: TERMS,
    default: 'mensual'
  },
  billingCycle: {
    type: String,
    enum: BILLING_CYCLES,
    default: 'calendar'
  },
  cycleNumber: { type: Number, default: 1, min: 1 },
  cyclesTotal: { type: Number, default: 1, min: 1 },
  // Une los ciclos de un mismo pago (se asigna al crear el plan)
  termId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  // Si al terminar el último ciclo se abre solo un ciclo nuevo "pendiente de pago"
  renews: {
    type: Boolean,
    default: true
  },
  // Ciclo abierto automáticamente sin pago registrado todavía. El paciente
  // puede agendar hasta paymentDueBy; si el admin no registra el pago, vence.
  paymentPending: {
    type: Boolean,
    default: false
  },
  paymentDueBy: {
    type: Date
  },
  // Plan del que nació este ciclo pendiente. El índice único evita abrir dos
  // renovaciones del mismo plan si dos procesos corren a la vez.
  renewedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientPlan'
  },
  renewalNotifiedAt: {
    type: Date
  },
  expiringTomorrowNotifiedAt: {
    type: Date
  },
  // Admin que registró el pago
  registeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Quién registró el pago es requerido']
  },
  notes: {
    type: String,
    trim: true
  },
  // Evitan que el cron de vencimiento (Paso 19 de BLUEPRINT.md) mande el
  // mismo aviso todos los días mientras el plan sigue en la ventana de "por
  // vencer" o ya vencido — cada uno se dispara una sola vez por plan.
  expiringNotifiedAt: {
    type: Date
  },
  expiredNotifiedAt: {
    type: Date
  }
}, {
  timestamps: true
});

clientPlanSchema.index({ patient: 1, status: 1 });
clientPlanSchema.index({ status: 1, endDate: 1 });
clientPlanSchema.index({ termId: 1, cycleNumber: 1 });
clientPlanSchema.index({ renewedFrom: 1 }, { unique: true, sparse: true });

clientPlanSchema.pre('validate', function (next) {
  if (this.unlimited) {
    if (!supportsUnlimited(this.serviceType)) {
      return next(new Error(`El plan ilimitado no está disponible para "${this.serviceType}"`));
    }
    this.sessionsTotal = 0;
    return next();
  }
  if (!isValidSessionsForServiceType(this.serviceType, this.sessionsTotal)) {
    const allowed = PLAN_CATALOG[this.serviceType] || [];
    return next(new Error(
      `sessionsTotal inválido para "${this.serviceType}". Valores permitidos: ${allowed.join(', ')}`
    ));
  }
  next();
});

// endDate = fin del ciclo que parte en startDate (mes calendario o fecha a fecha)
clientPlanSchema.pre('save', function (next) {
  if (this.isModified('startDate') || this.isModified('billingCycle') || !this.endDate) {
    this.endDate = cycleBounds(this.startDate, this.billingCycle, 0).end;
  }
  next();
});

clientPlanSchema.methods.sessionsAvailable = function () {
  if (this.unlimited) return UNLIMITED_AVAILABLE;
  return Math.max(0, this.sessionsTotal - this.sessionsUsed);
};

clientPlanSchema.methods.isExpiredByDate = function () {
  return this.endDate && this.endDate.getTime() < Date.now();
};

const ClientPlan = mongoose.model('ClientPlan', clientPlanSchema);

export default ClientPlan;
