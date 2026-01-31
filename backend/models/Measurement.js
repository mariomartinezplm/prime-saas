import mongoose from 'mongoose';

const measurementSchema = new mongoose.Schema({
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
  // Perímetros corporales en centímetros
  perimeters: {
    bicepLeft: {
      type: Number,
      min: [0, 'El valor debe ser positivo']
    },
    bicepRight: {
      type: Number,
      min: [0, 'El valor debe ser positivo']
    },
    chest: {
      type: Number,
      min: [0, 'El valor debe ser positivo']
    },
    waist: {
      type: Number,
      min: [0, 'El valor debe ser positivo']
    },
    hips: {
      type: Number,
      min: [0, 'El valor debe ser positivo']
    },
    thighLeft: {
      type: Number,
      min: [0, 'El valor debe ser positivo']
    },
    thighRight: {
      type: Number,
      min: [0, 'El valor debe ser positivo']
    },
    calfLeft: {
      type: Number,
      min: [0, 'El valor debe ser positivo']
    },
    calfRight: {
      type: Number,
      min: [0, 'El valor debe ser positivo']
    },
    forearmLeft: {
      type: Number,
      min: [0, 'El valor debe ser positivo']
    },
    forearmRight: {
      type: Number,
      min: [0, 'El valor debe ser positivo']
    }
  },
  // Mediciones adicionales
  weight: {
    type: Number,
    min: [0, 'El peso debe ser positivo']
  },
  height: {
    type: Number,
    min: [0, 'La altura debe ser positiva']
  },
  bodyFatPercentage: {
    type: Number,
    min: [0, 'El porcentaje debe ser entre 0 y 100'],
    max: [100, 'El porcentaje debe ser entre 0 y 100']
  },
  muscleMassPercentage: {
    type: Number,
    min: [0, 'El porcentaje debe ser entre 0 y 100'],
    max: [100, 'El porcentaje debe ser entre 0 y 100']
  },
  // IMC calculado automáticamente
  bmi: {
    type: Number
  },
  notes: {
    type: String,
    trim: true
  },
  photos: [{
    url: String,
    position: {
      type: String,
      enum: ['front', 'back', 'side-left', 'side-right']
    },
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Índices para mejorar el rendimiento
measurementSchema.index({ patient: 1, date: -1 });

// Calcular IMC antes de guardar si hay peso y altura
measurementSchema.pre('save', function(next) {
  if (this.weight && this.height) {
    const heightInMeters = this.height / 100;
    this.bmi = parseFloat((this.weight / (heightInMeters * heightInMeters)).toFixed(2));
  }
  next();
});

// Método para obtener el cambio desde la última medición
measurementSchema.statics.getProgressSinceLastMeasurement = async function(patientId, currentMeasurementId) {
  const measurements = await this.find({
    patient: patientId,
    _id: { $ne: currentMeasurementId }
  })
  .sort({ date: -1 })
  .limit(1);

  if (measurements.length === 0) {
    return null;
  }

  return measurements[0];
};

const Measurement = mongoose.model('Measurement', measurementSchema);

export default Measurement;
