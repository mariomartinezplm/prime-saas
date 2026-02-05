// Tipos de Usuario
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: 'admin' | 'professional' | 'patient';
  phone?: string;
  dateOfBirth?: string;
  rut?: string;
  address?: string;
  profileImage?: string;
  specialty?: string;
  emergencyContact?: EmergencyContact;
  medicalInfo?: MedicalInfo;
  isActive: boolean;
  createdAt: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface MedicalInfo {
  chronicConditions?: string[];
  medications?: string[];
  allergies?: string[];
  injuries?: string[];
  surgeries?: Array<{
    description: string;
    date: string;
  }>;
}

// Tipos de Autenticación
export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: string;
  rut?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

// Tipos de Citas
export interface Appointment {
  _id: string;
  patient: User | string;
  professional: User | string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  type: 'kinesiologia' | 'entrenamiento' | 'evaluacion';
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: User | string;
  cancelledAt?: string;
  sessionNotes?: string;
  exercisesPerformed?: Array<{
    exercise: string;
    sets: number;
    reps: number;
    weight: number;
    notes?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentData {
  patient?: string;
  professional: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'kinesiologia' | 'entrenamiento' | 'evaluacion';
  notes?: string;
}

export interface BulkBookingData {
  appointments: Array<{
    professional: string;
    date: string;
    startTime: string;
    endTime: string;
    type: 'kinesiologia' | 'entrenamiento' | 'evaluacion';
  }>;
  patient?: string;
}

// Tipos de Disponibilidad
export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export interface DaySchedule {
  dayOfWeek: number;
  slots: TimeSlot[];
}

export interface BlockedDate {
  _id?: string;
  date: string;
  slots?: TimeSlot[];
  allDay: boolean;
  reason?: string;
}

export interface Availability {
  _id: string;
  professional: User | string;
  weeklySchedule: DaySchedule[];
  blockedDates: BlockedDate[];
  createdAt: string;
  updatedAt: string;
}

export interface AvailableSlots {
  date: string;
  availableSlots: string[];
  bookedSlots: string[];
  blockedSlots?: string[];
}

// Tipos de Plan
export interface Plan {
  _id: string;
  patient: User | string;
  professional: User | string;
  type: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  sessionsPerWeek: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanData {
  patient: string;
  professional: string;
  type: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  sessionsPerWeek: number;
  startDate: string;
  notes?: string;
}

// Tipos de Mediciones
export interface Perimeters {
  bicepLeft?: number;
  bicepRight?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  thighLeft?: number;
  thighRight?: number;
  calfLeft?: number;
  calfRight?: number;
  forearmLeft?: number;
  forearmRight?: number;
}

export interface Measurement {
  _id: string;
  patient: User | string;
  recordedBy: User | string;
  date: string;
  perimeters: Perimeters;
  weight?: number;
  height?: number;
  bodyFatPercentage?: number;
  muscleMassPercentage?: number;
  bmi?: number;
  notes?: string;
  photos?: Array<{
    url: string;
    position: 'front' | 'back' | 'side-left' | 'side-right';
    uploadDate: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMeasurementData {
  patient: string;
  date?: string;
  perimeters: Perimeters;
  weight?: number;
  height?: number;
  bodyFatPercentage?: number;
  muscleMassPercentage?: number;
  notes?: string;
}

// Tipos de Ejercicios
export interface ExerciseProgress {
  _id: string;
  patient: User | string;
  recordedBy: User | string;
  exerciseName: string;
  category: 'fuerza' | 'cardio' | 'flexibilidad' | 'funcional' | 'rehabilitacion' | 'otro';
  date: string;
  sets?: number;
  reps?: number;
  weight?: number;
  weightUnit: 'kg' | 'lbs';
  duration?: number;
  distance?: number;
  distanceUnit: 'm' | 'km' | 'mi';
  rpe?: number;
  notes?: string;
  techniqueRating?: number;
  videoUrl?: string;
  oneRepMax?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExerciseData {
  patient: string;
  exerciseName: string;
  category: 'fuerza' | 'cardio' | 'flexibilidad' | 'funcional' | 'rehabilitacion' | 'otro';
  date?: string;
  sets?: number;
  reps?: number;
  weight?: number;
  weightUnit?: 'kg' | 'lbs';
  duration?: number;
  distance?: number;
  distanceUnit?: 'm' | 'km' | 'mi';
  rpe?: number;
  notes?: string;
  techniqueRating?: number;
}

// Tipos de EVA (Escala del Dolor)
export interface EVARecord {
  _id: string;
  patient: User | string;
  recordedBy: User | string;
  date: string;
  painLevel: number;
  bodyArea: string;
  painType?: string[];
  duration?: 'agudo' | 'subagudo' | 'cronico';
  worstTime?: 'manana' | 'tarde' | 'noche' | 'constante' | 'variable';
  aggravatingFactors?: string[];
  relievingFactors?: string[];
  functionalImpact?: number;
  medication?: string;
  functionalTests?: Array<{
    testName: string;
    result: string;
    score?: number;
    notes?: string;
  }>;
  observations?: string;
  treatmentPlan?: string;
  followUp?: {
    required: boolean;
    date?: string;
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateEVAData {
  patient: string;
  date?: string;
  painLevel: number;
  bodyArea: string;
  painType?: string[];
  duration?: 'agudo' | 'subagudo' | 'cronico';
  worstTime?: 'manana' | 'tarde' | 'noche' | 'constante' | 'variable';
  aggravatingFactors?: string[];
  relievingFactors?: string[];
  functionalImpact?: number;
  medication?: string;
  observations?: string;
  treatmentPlan?: string;
}

// Tipos de Respuestas de la API
export interface APIResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  count?: number;
  total?: number;
  page?: number;
  pages?: number;
}

// Tipos de Dashboard
export interface DashboardStats {
  totalPatients: number;
  activePatients: number;
  todayAppointments: number;
  upcomingAppointments: Appointment[];
  recentPatients: User[];
}

export interface PatientProfile {
  patient: User;
  stats: {
    totalAppointments: number;
    totalMeasurements: number;
    totalExercises: number;
    totalEVARecords: number;
  };
  upcomingAppointments: Appointment[];
  recentMeasurements: Measurement[];
  recentEVARecords: EVARecord[];
}
