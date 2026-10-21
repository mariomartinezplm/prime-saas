import mongoose from 'mongoose';

// Entrenamiento en curso (Workout Experience 1.0). Es un registro PERSONAL del paciente: NO modifica la cita, no descuenta
// sesiones, no ocupa cupos y no otorga logros de asistencia.
//
// Los dos relojes se guardan como INSTANTES, nunca como cuentas:
//  - cronómetro de sesión: `startedAt` (hora del servidor al pulsar «Iniciar»); no tiene tope de duración.
//  - descanso: `rest.dueAt` (instante en que vence) o `rest.remainingSec` si está en pausa.
const restSchema = new mongoose.Schema(
  {
    state: { type: String, enum: ['idle', 'running', 'paused', 'done'], default: 'idle' },
    // Vencimiento del descanso en curso (solo con state = running)
    dueAt: { type: Date },
    // Segundos que faltaban al pausar (solo con state = paused)
    remainingSec: { type: Number, min: 0 },
    // Duración elegida del descanso actual y del PRÓXIMO (cambiar el próximo nunca altera uno activo)
    durationSec: { type: Number, min: 5, max: 1800, default: 120 },
    nextDurationSec: { type: Number, min: 5, max: 1800, default: 120 },
    // Sube en cada cambio: detecta ediciones de otra pestaña o dispositivo
    version: { type: Number, default: 0 }
  },
  { _id: false }
);

const workoutSessionSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'El paciente es requerido'], index: true },
    // Cita relacionada (opcional). Solo se LEE para saber cuándo se puede iniciar; nunca se modifica.
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    // Idempotencia del inicio: reintentar el mismo inicio devuelve la misma sesión
    clientId: { type: String, trim: true, maxlength: 80 },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    status: { type: String, enum: ['active', 'finished', 'auto_closed'], default: 'active' },
    // Última acción del paciente (inicio, descanso…). Sirve para cerrar sesiones abandonadas con una hora de fin honesta.
    lastActivityAt: { type: Date, required: true },
    rest: { type: restSchema, default: () => ({}) }
  },
  { timestamps: true }
);

// Una sola sesión activa por paciente (lo garantiza la base de datos, no solo el código)
workoutSessionSchema.index({ patient: 1 }, { unique: true, partialFilterExpression: { status: 'active' }, name: 'una_activa_por_paciente' });
workoutSessionSchema.index({ patient: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } }, name: 'inicio_idempotente' });

export default mongoose.model('WorkoutSession', workoutSessionSchema);
