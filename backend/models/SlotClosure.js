import mongoose from 'mongoose';

// «Cerrar horario»: el profesional deja de recibir pacientes NUEVOS en una hora de un día concreto. Las citas que ya están se
// mantienen tal cual (no se cancela ni se descuenta nada). Es solo una marca: no toca citas, planes ni pagos.
// `date` es el día calendario (YYYY-MM-DD), el mismo que usan las citas; `startTime` es el inicio de la hora que se cierra (HH:00 o HH:30).
const slotClosureSchema = new mongoose.Schema(
  {
    professional: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: [/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'] },
    startTime: { type: String, required: true, match: [/^([01]\d|2[0-3]):(00|30)$/, 'La hora debe empezar en punto o y media'] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

// Cerrar dos veces la misma hora es lo mismo que cerrarla una vez
slotClosureSchema.index({ professional: 1, date: 1, startTime: 1 }, { unique: true });

export default mongoose.model('SlotClosure', slotClosureSchema);
