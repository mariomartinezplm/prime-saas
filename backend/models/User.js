import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'El apellido es requerido'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Por favor ingrese un email válido']
  },
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'professional', 'patient'],
    default: 'patient'
  },
  specialty: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  rut: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    enum: ['Masculino', 'Femenino', 'Otro', ''],
    default: ''
  },
  healthInsurance: {
    type: String,
    trim: true
  },
  objectives: [String],
  assignedProfessional: {
    type: String,
    trim: true
  },
  referralSource: {
    type: String,
    trim: true
  },
  lastPaymentDate: {
    type: Date
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  medicalInfo: {
    chronicConditions: [String],
    medications: [String],
    allergies: [String],
    injuries: [String],
    surgeries: [{
      description: String,
      date: Date
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profileImage: {
    type: String,
    default: ''
  },
  airtableId: {
    type: String,
    unique: true,
    sparse: true
  },
  lastActivityDate: {
    type: Date
  },
  source: {
    type: String,
    default: 'web'
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
}, {
  timestamps: true
});

// Encriptar contraseña antes de guardar
userSchema.pre('save', async function (next) {
  // Solo encriptar si la contraseña ha sido modificada
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para obtener el nombre completo
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Asegurar que los virtuals se incluyan cuando se convierta a JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);

export default User;
