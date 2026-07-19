import mongoose from 'mongoose';
import { PLAN_CATALOG, isValidSessionsForServiceType } from '../config/planCatalog.js';

const DAYS_PER_CYCLE = 30;

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
  // Se calcula automáticamente: startDate + 30 días
  endDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
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
  }
}, {
  timestamps: true
});

clientPlanSchema.index({ patient: 1, status: 1 });
clientPlanSchema.index({ status: 1, endDate: 1 });

clientPlanSchema.pre('validate', function (next) {
  if (!isValidSessionsForServiceType(this.serviceType, this.sessionsTotal)) {
    const allowed = PLAN_CATALOG[this.serviceType] || [];
    return next(new Error(
      `sessionsTotal inválido para "${this.serviceType}". Valores permitidos: ${allowed.join(', ')}`
    ));
  }
  next();
});

// Calcular endDate = startDate + 30 días
clientPlanSchema.pre('save', function (next) {
  if (this.isModified('startDate') || !this.endDate) {
    const end = new Date(this.startDate);
    end.setDate(end.getDate() + DAYS_PER_CYCLE);
    this.endDate = end;
  }
  next();
});

clientPlanSchema.methods.sessionsAvailable = function () {
  return Math.max(0, this.sessionsTotal - this.sessionsUsed);
};

clientPlanSchema.methods.isExpiredByDate = function () {
  return this.endDate && this.endDate.getTime() < Date.now();
};

// Marca como 'expired' todos los planes activos cuya endDate ya pasó.
// Devuelve cuántos se actualizaron.
clientPlanSchema.statics.expireOverduePlans = async function (patientId) {
  const query = {
    status: 'active',
    endDate: { $lt: new Date() }
  };
  if (patientId) query.patient = patientId;

  const result = await this.updateMany(query, { $set: { status: 'expired' } });
  return result.modifiedCount || 0;
};

const ClientPlan = mongoose.model('ClientPlan', clientPlanSchema);

export default ClientPlan;
