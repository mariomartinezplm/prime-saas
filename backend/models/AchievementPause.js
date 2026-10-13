import mongoose from 'mongoose';

// "Pausa autorizada": un mes en que el paciente no pudo entrenar con normalidad (lesión, viaje, vacaciones,
// motivos personales) y el profesional o el admin lo dejó anotado. Ese mes es NEUTRAL para las rachas: no suma
// ni la rompe. No inventa sesiones ni concede nada por sí misma.
//
// El motivo puede ser sensible (una lesión, por ejemplo): lo ve el personal con acceso al paciente; la
// pantalla del paciente solo dice "pausa autorizada".
const achievementPauseSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El paciente es requerido']
  },
  // Mes de la pausa, 'YYYY-MM' (mismo criterio que el periodo de los planes: mes en que termina el ciclo)
  periodKey: {
    type: String,
    required: [true, 'El mes es requerido'],
    match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'El mes debe tener el formato AAAA-MM']
  },
  reason: {
    type: String,
    required: [true, 'El motivo es requerido'],
    trim: true,
    maxlength: [300, 'El motivo no puede superar 300 caracteres']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Quién la registró es requerido']
  }
}, {
  timestamps: true
});

achievementPauseSchema.index({ patient: 1, periodKey: 1 }, { unique: true });

const AchievementPause = mongoose.model('AchievementPause', achievementPauseSchema);

export default AchievementPause;
