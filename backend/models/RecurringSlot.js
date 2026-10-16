import mongoose from 'mongoose';

// Horario fijo semanal de un paciente (ej. «todos los lunes a las 18:00»).
//
// Es la REGLA, no las citas: cada vez que el plan del paciente tiene días por delante, el sistema agenda las citas que faltan
// de esta regla (ver services/recurringSlotService.js). Las citas generadas son citas normales (llevan `recurringSlot`) y se
// pueden cancelar una por una. Borrar o pausar el horario NO cancela las citas que ya existen.
export const RECURRING_TYPES = ['kinesiologia', 'entrenamiento'];

const skippedSchema = new mongoose.Schema({
  // Fecha que se saltó, 'YYYY-MM-DD'
  date: { type: String, required: true },
  // FULL (horario lleno) | NOT_AVAILABLE (el profesional no atiende ese día/hora) | ALREADY_BOOKED (ya tenía otra cita ese día)
  code: { type: String, required: true },
  // Cuándo se avisó a la persona (null = todavía no)
  notifiedAt: { type: Date, default: null }
}, { _id: false });

const recurringSlotSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  professional: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // 1 = lunes … 6 = sábado (mismo criterio que Availability.weeklySchedule; el domingo no se atiende)
  dayOfWeek: { type: Number, required: true, min: 1, max: 6 },
  startTime: {
    type: String,
    required: true,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
  },
  type: { type: String, enum: RECURRING_TYPES, required: true },
  // En pausa: no se agendan citas nuevas (las ya agendadas se mantienen)
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Fechas ya resueltas que no se vuelven a intentar (para no repetir avisos ni gastar una sesión dos veces)
  skipped: { type: [skippedSchema], default: [] }
}, { timestamps: true });

recurringSlotSchema.index({ patient: 1, active: 1 });
// Un solo horario fijo por día de la semana y paciente
recurringSlotSchema.index({ patient: 1, dayOfWeek: 1 }, { unique: true });

const RecurringSlot = mongoose.model('RecurringSlot', recurringSlotSchema);

export default RecurringSlot;
