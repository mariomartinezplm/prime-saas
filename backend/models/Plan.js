import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El paciente es requerido']
  },
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El profesional es requerido']
  },
  type: {
    type: String,
    enum: ['mensual', 'trimestral', 'semestral', 'anual'],
    required: [true, 'El tipo de plan es requerido']
  },
  sessionsPerWeek: {
    type: Number,
    required: [true, 'Las sesiones por semana son requeridas'],
    min: [1, 'Mínimo 1 sesión por semana'],
    max: [7, 'Máximo 7 sesiones por semana']
  },
  startDate: {
    type: Date,
    required: [true, 'La fecha de inicio es requerida']
  },
  endDate: {
    type: Date,
    required: [true, 'La fecha de fin es requerida']
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

planSchema.index({ patient: 1, status: 1 });
planSchema.index({ patient: 1, startDate: 1, endDate: 1 });

// Auto-calculate endDate based on type and startDate
planSchema.pre('validate', function(next) {
  if (this.isModified('startDate') || this.isModified('type')) {
    const start = new Date(this.startDate);
    switch (this.type) {
      case 'mensual':
        this.endDate = new Date(start.setMonth(start.getMonth() + 1));
        break;
      case 'trimestral':
        this.endDate = new Date(start.setMonth(start.getMonth() + 3));
        break;
      case 'semestral':
        this.endDate = new Date(start.setMonth(start.getMonth() + 6));
        break;
      case 'anual':
        this.endDate = new Date(start.setFullYear(start.getFullYear() + 1));
        break;
    }
  }
  next();
});

const Plan = mongoose.model('Plan', planSchema);

export default Plan;
