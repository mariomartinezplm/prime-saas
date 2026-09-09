import mongoose from 'mongoose';

// Escala 1-5 uniforme para las 5 métricas: 1 = mal, 5 = bien. Para que el
// promedio simple sirva de alerta (<2.5 = mal), "estrés" y "dolor muscular"
// se preguntan en sentido inverso en la UI ("qué tan poco estrés/dolor" en
// vez de "cuánto estrés/dolor") — el dato que se guarda siempre sigue esta
// misma dirección, no hace falta invertir nada al calcular el promedio.
const wellnessCheckinSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El paciente es requerido']
  },
  // "YYYY-MM-DD" en hora de Santiago (Paso 17: nowInSantiago), no la del
  // servidor — así el índice único por día coincide con el día real del
  // paciente en Chile, no con UTC.
  date: {
    type: String,
    required: [true, 'La fecha es requerida']
  },
  sleep: { type: Number, required: true, min: 1, max: 5 },
  energy: { type: Number, required: true, min: 1, max: 5 },
  stress: { type: Number, required: true, min: 1, max: 5 },
  soreness: { type: Number, required: true, min: 1, max: 5 },
  mood: { type: Number, required: true, min: 1, max: 5 },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// 1 check-in por paciente por día garantizado por la base de datos, no solo
// por el frontend (Paso 23 de BLUEPRINT.md).
wellnessCheckinSchema.index({ patient: 1, date: 1 }, { unique: true });

wellnessCheckinSchema.methods.average = function () {
  return (this.sleep + this.energy + this.stress + this.soreness + this.mood) / 5;
};

const WellnessCheckin = mongoose.model('WellnessCheckin', wellnessCheckinSchema);

export default WellnessCheckin;
