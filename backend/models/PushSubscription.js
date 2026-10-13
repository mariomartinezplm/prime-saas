import mongoose from 'mongoose';

// Una suscripción de notificaciones push de UN navegador/dispositivo. El `endpoint` identifica al navegador
// y es único: si otra persona inicia sesión en el mismo navegador y activa las notificaciones, la suscripción
// pasa a ella (así los avisos del usuario anterior dejan de llegarle).
//
// `keys` son claves públicas de cifrado del navegador (no son secretos del servidor), pero igual nunca salen
// por la API ni se registran en logs.
const pushSubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es requerido']
  },
  endpoint: {
    type: String,
    required: [true, 'El endpoint es requerido'],
    unique: true,
    maxlength: 2048
  },
  keys: {
    p256dh: { type: String, required: true, maxlength: 256 },
    auth: { type: String, required: true, maxlength: 256 }
  },
  userAgent: { type: String, maxlength: 300 },
  // Cuántos envíos seguidos fallaron (sin contar los 404/410, que la borran al instante)
  failureCount: { type: Number, default: 0 },
  lastSuccessAt: { type: Date }
}, {
  timestamps: true
});

pushSubscriptionSchema.index({ user: 1, updatedAt: -1 });

pushSubscriptionSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.keys;
    return ret;
  }
});

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

export default PushSubscription;
