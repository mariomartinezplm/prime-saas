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
      'wellness_alert'
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

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
