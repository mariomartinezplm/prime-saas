import mongoose from 'mongoose';
import {
  PLAN_CATALOG,
  UNLIMITED_AVAILABLE,
  isValidSessionsForServiceType,
  supportsUnlimited
} from '../config/planCatalog.js';
import { TERMS, BILLING_CYCLES, PAYMENT_MODES, cycleBounds, OPEN_END_DATE } from '../services/planCycles.js';

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
  // Plan «hasta completar las sesiones» (kinesiología): no tiene ciclos ni vence por fecha; dura lo que tarden en usarse sus sesiones.
  // Por dentro endDate queda en una fecha lejana fija (OPEN_END_DATE) para que todas las consultas por fecha sigan funcionando,
  // y las pantallas muestran «hasta completar las sesiones» en vez de esa fecha.
  openEnded: {
    type: Boolean,
    default: false
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
  // Cómo se paga un plan de varios meses: 'prepaid' = de una vez (con su descuento); 'monthly' = mes a mes, sin renovar a mano
  // (clientes que siempre pagan: el plan queda cargado por todo el plazo, pero en Ingresos cada mes vale su tarifa mensual).
  paymentMode: {
    type: String,
    enum: PAYMENT_MODES,
    default: 'prepaid'
  },
  // Beca total: plan sin costo. Cuenta como $0 en Ingresos y se identifica como beca.
  scholarship: { type: Boolean, default: false },
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
  // Días de plazo para pagar la renovación, contados desde que empieza el ciclo nuevo (se elige al registrar el plan y se puede editar)
  graceDays: {
    type: Number,
    default: 5,
    min: 0,
    max: 30
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
  // Ciclo que se abrió solo, ya activo y sin pago pendiente (beca o miembro fundador): nadie tuvo que registrar un pago para renovarlo
  autoRenewed: { type: Boolean, default: false },
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
  },
  // Los 4 correos de «plan por vencer»: 5 días antes (expiringNotifiedAt), 3 días antes, el día del vencimiento y el día 3 del
  // mes siguiente si la renovación sigue sin pagarse. Cada uno sale una sola vez; al renovarse dejan de salir.
  expiring3dNotifiedAt: { type: Date },
  expiringTodayNotifiedAt: { type: Date },
  pendingReminderNotifiedAt: { type: Date },
  pendingLastDayNotifiedAt: { type: Date }
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
  if (this.openEnded) {
    this.endDate = OPEN_END_DATE;
  } else if (this.isModified('startDate') || this.isModified('billingCycle') || !this.endDate) {
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
