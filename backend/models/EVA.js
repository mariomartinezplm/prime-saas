import mongoose from 'mongoose';

const evaSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El paciente es requerido']
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El profesional que registra es requerido']
  },
  date: {
    type: Date,
    required: [true, 'La fecha es requerida'],
    default: Date.now
  },
  // Escala de dolor 0-10
  painLevel: {
    type: Number,
    required: [true, 'El nivel de dolor es requerido'],
    min: [0, 'El nivel de dolor debe estar entre 0 y 10'],
    max: [10, 'El nivel de dolor debe estar entre 0 y 10']
  },
  // Zona corporal afectada
  bodyArea: {
    type: String,
    required: [true, 'La zona corporal es requerida'],
    enum: [
      'cabeza',
      'cuello',
      'hombro-izquierdo',
      'hombro-derecho',
      'codo-izquierdo',
      'codo-derecho',
      'muneca-izquierda',
      'muneca-derecha',
      'espalda-alta',
      'espalda-media',
      'espalda-baja',
      'lumbar',
      'cadera-izquierda',
      'cadera-derecha',
      'rodilla-izquierda',
      'rodilla-derecha',
      'tobillo-izquierdo',
      'tobillo-derecho',
      'pie-izquierdo',
      'pie-derecho',
      'pecho',
      'abdomen',
      'otro'
    ]
  },
  // Descripción del dolor
  painType: {
    type: [String],
    enum: [
      'agudo',
      'punzante',
      'sordo',
      'pulsante',
      'quemante',
      'hormigueo',
      'entumecimiento',
      'rigidez',
      'inflamacion',
      'otro'
    ]
  },
  // Duración del episodio
  duration: {
    type: String,
    enum: ['agudo', 'subagudo', 'cronico'], // agudo: <6 semanas, subagudo: 6-12 semanas, crónico: >12 semanas
  },
  // Momento del día cuando es peor
  worstTime: {
    type: String,
    enum: ['manana', 'tarde', 'noche', 'constante', 'variable']
  },
  // Factores que empeoran el dolor
  aggravatingFactors: [{
    type: String,
    trim: true
  }],
  // Factores que alivian el dolor
  relievingFactors: [{
    type: String,
    trim: true
  }],
  // Impacto en actividades diarias (0-10)
  functionalImpact: {
    type: Number,
    min: [0, 'El impacto debe estar entre 0 y 10'],
    max: [10, 'El impacto debe estar entre 0 y 10']
  },
  // Medicación tomada
  medication: {
    type: String,
    trim: true
  },
  // Tests funcionales realizados
  functionalTests: [{
    testName: {
      type: String,
      required: true
    },
    result: {
      type: String,
      required: true
    },
    score: Number,
    notes: String
  }],
  // Punto exacto del dolor en el diagrama (0-100 para X e Y)
  point: {
    x: { type: Number, min: 0, max: 100 },
    y: { type: Number, min: 0, max: 100 }
  },
  // Observaciones del profesional
  observations: {
    type: String,
    trim: true
  },
  // Plan de tratamiento
  treatmentPlan: {
    type: String,
    trim: true
  },
  // Seguimiento
  followUp: {
    required: {
      type: Boolean,
      default: false
    },
    date: Date,
    notes: String
  }
}, {
  timestamps: true
});

// Índices para mejorar el rendimiento
evaSchema.index({ patient: 1, date: -1 });
evaSchema.index({ patient: 1, bodyArea: 1, date: -1 });

// Método estático para obtener la evolución del dolor en un área específica
evaSchema.statics.getPainEvolution = async function (patientId, bodyArea, limit = 20) {
  return await this.find({
    patient: patientId,
    bodyArea: bodyArea
  })
    .sort({ date: -1 })
    .limit(limit)
    .select('date painLevel functionalImpact observations')
    .populate('recordedBy', 'firstName lastName');
};

// Método estático para obtener todas las áreas con dolor de un paciente
evaSchema.statics.getAffectedAreas = async function (patientId) {
  return await this.aggregate([
    { $match: { patient: mongoose.Types.ObjectId(patientId) } },
    {
      $group: {
        _id: '$bodyArea',
        latestPainLevel: { $last: '$painLevel' },
        averagePainLevel: { $avg: '$painLevel' },
        recordCount: { $sum: 1 },
        lastRecordDate: { $max: '$date' }
      }
    },
    { $sort: { lastRecordDate: -1 } }
  ]);
};

// Método para determinar la severidad del dolor
evaSchema.methods.getPainSeverity = function () {
  if (this.painLevel === 0) return 'Sin dolor';
  if (this.painLevel <= 3) return 'Dolor leve';
  if (this.painLevel <= 6) return 'Dolor moderado';
  if (this.painLevel <= 9) return 'Dolor severo';
  return 'Dolor muy severo';
};

const EVA = mongoose.model('EVA', evaSchema);

export default EVA;
