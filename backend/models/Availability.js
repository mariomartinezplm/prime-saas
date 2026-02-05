import mongoose from 'mongoose';

const availabilitySchema = new mongoose.Schema({
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El profesional es requerido']
  },
  // Horario recurrente semanal (0=Domingo, 1=Lunes, ..., 6=Sábado)
  weeklySchedule: [{
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6
    },
    slots: [{
      startTime: {
        type: String,
        required: true,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
      },
      endTime: {
        type: String,
        required: true,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
      }
    }]
  }],
  // Bloqueos por fecha específica (vacaciones, ausencias, etc.)
  blockedDates: [{
    date: {
      type: Date,
      required: true
    },
    slots: [{
      startTime: String,
      endTime: String
    }],
    allDay: {
      type: Boolean,
      default: false
    },
    reason: {
      type: String,
      trim: true
    }
  }]
}, {
  timestamps: true
});

availabilitySchema.index({ professional: 1 });

const Availability = mongoose.model('Availability', availabilitySchema);

export default Availability;
