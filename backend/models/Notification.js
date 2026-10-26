import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El destinatario es requerido']
  },
  type: {
    type: String,
    enum: [
      'evolution_updated',
      'plan_expiring',
      'plan_expired',
      'appointment_booked',
      'appointment_cancelled',
      'wellness_alert',
      'achievement_unlocked',
      'readiness_reminder',
      'weekly_booking_reminder',
      'midweek_booking_reminder',
      'recurring_booked',
      'recurring_skipped',
      'goal_pending_validation',
      'plan_auto_renewed',
      'birthday_week',
      'birthday_today'
    ],
    required: [true, 'El tipo de notificación es requerido']
  },
  title: {
    type: String,
    required: [true, 'El título es requerido'],
    trim: true
  },
  body: {
    type: String,
    required: [true, 'El cuerpo es requerido'],
    trim: true
  },
  link: {
    type: String,
    trim: true
  },
  // Clave opcional que identifica un aviso "de una sola vez" (p. ej. 'achievement:<paciente>:<logro>:<periodo>').
  // El índice único evita duplicados aunque el mismo evento se procese dos veces.
  dedupeKey: {
    type: String,
    trim: true
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
