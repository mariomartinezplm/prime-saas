// Tipos de Usuario
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: 'admin' | 'professional' | 'patient';
  // Miembro Fundador (plan anual); lo calcula el servidor
  isFounder?: boolean;
  phone?: string;
  dateOfBirth?: string;
  rut?: string;
  address?: string;
  gender?: 'Masculino' | 'Femenino' | 'Otro' | '';
  healthInsurance?: string;
  objectives?: string[];
  referralSource?: string;
  profileImage?: string;
  specialty?: string;
  emergencyContact?: EmergencyContact;
  medicalInfo?: MedicalInfo;
  isActive: boolean;
  assignedProfessional?: string;
  assignedProfessionalId?: User | string;
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
  heightCm?: number;
  baseWeightKg?: number;
  smoker?: boolean;
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
  overbooked?: boolean;
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
  allowOverbook?: boolean;
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

// Tipos de ClientPlan (sistema de planes por bono de sesiones)
export interface ClientPlan {
  _id: string;
  patient: User | string;
  serviceType: 'entrenamiento' | 'kinesiologia';
  sessionsTotal: number;
  unlimited?: boolean;
  sessionsUsed: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled' | 'upcoming';
  term?: 'mensual' | 'trimestral' | 'anual';
  billingCycle?: 'calendar' | 'rolling';
  cycleNumber?: number;
  cyclesTotal?: number;
  renews?: boolean;
  // Renovación abierta sin pago registrado: se puede agendar hasta paymentDueBy
  paymentPending?: boolean;
  paymentDueBy?: string;
  registeredBy: User | string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientPlanData {
  patientId: string;
  serviceType: 'entrenamiento' | 'kinesiologia';
  sessionsTotal: number;
  unlimited?: boolean;
  term?: 'mensual' | 'trimestral' | 'anual';
  billingCycle?: 'calendar' | 'rolling';
  renews?: boolean;
  startDate?: string;
  notes?: string;
  replaceExisting?: boolean;
}

export interface SessionBalance {
  hasActivePlan: boolean;
  plan: ClientPlan | null;
  paymentPending?: boolean;
  paymentDueBy?: string | null;
  planSessionsAvailable: number;
  extraSessionsAvailable: number;
  totalAvailable: number;
}

export interface ExtraSession {
  _id: string;
  patient: User | string;
  serviceType: 'entrenamiento' | 'kinesiologia';
  grantedBy: User | string;
  reason?: string;
  date: string;
  used: boolean;
  usedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExtraSessionData {
  patientId: string;
  serviceType: 'entrenamiento' | 'kinesiologia';
  reason?: string;
}

// Tipos de Mediciones
export interface Perimeters {
  bicepLeft?: number;
  bicepRight?: number;
  forearmLeft?: number;
  forearmRight?: number;
  shoulders?: number; // Hombros
  chest?: number; // Pecho
  neck?: number; // Cuello
  waist?: number; // Cintura
  hips?: number; // Cadera
  thighLeft?: number; // Pierna
  thighRight?: number;
  calfLeft?: number; // Gemelo
  calfRight?: number;
}

// Tests de saltos
export interface JumpTests {
  cmj?: number; // Counter Movement Jump (cm)
  sj?: number; // Squat Jump (cm)
  cmjLeftLeg?: number; // CMJ unipodal pie izquierdo (cm)
  cmjRightLeg?: number; // CMJ unipodal pie derecho (cm)
  sjLeftLeg?: number; // SJ unipodal pie izquierdo (cm)
  sjRightLeg?: number; // SJ unipodal pie derecho (cm)
  dropJump?: number; // Drop Jump (cm)
  abalakov?: number; // Abalakov Jump (con brazos)
  horizontalJump?: number; // Salto Horizontal
}

export interface Measurement {
  _id: string;
  patient: User | string;
  recordedBy: User | string;
  date: string;
  perimeters: Perimeters;
  jumpTests?: JumpTests; // Tests de salto
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
  point?: { x: number; y: number; gender?: 'male' | 'female' };
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
  point?: { x: number; y: number; gender?: 'male' | 'female' };
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

// Tipos de Notification (Paso 19/20 de BLUEPRINT.md)
export type NotificationType =
  | 'evolution_updated'
  | 'plan_expiring'
  | 'plan_expired'
  | 'appointment_booked'
  | 'appointment_cancelled'
  | 'wellness_alert';

export interface Notification {
  _id: string;
  user: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Tipos de WellnessCheckin (Paso 23 de BLUEPRINT.md)
export interface WellnessCheckin {
  _id: string;
  patient: string;
  date: string; // "YYYY-MM-DD"
  sleep: number;
  energy: number;
  stress: number;
  soreness: number;
  mood: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWellnessCheckinData {
  sleep: number;
  energy: number;
  stress: number;
  soreness: number;
  mood: number;
  notes?: string;
}

export interface WellnessTrend {
  patient: { _id: string; firstName: string; lastName: string };
  checkinsThisWeek: number;
  weeklyAverage: number | null;
  lastCheckin: WellnessCheckin | null;
  isLowAlert: boolean;
}

export interface ClientFile {
  _id: string;
  patient: string;
  uploadedBy: string | { _id?: string; id?: string; firstName: string; lastName: string; role: 'admin' | 'professional' | 'patient' };
  fileName: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  sizeBytes: number;
  description?: string;
  createdAt: string;
}

export interface FileDownloadLink {
  url: string;
  expiresIn: number;
  fileName: string;
  mimeType: string;
}

// Fotos de progreso. "private" = solo quien la sube y el admin (nunca el profesional asignado)
export type PhotoPosition = 'front' | 'back' | 'side-left' | 'side-right' | 'other';
export type PhotoVisibility = 'shared' | 'private';

export interface ProgressPhoto {
  id: string;
  patient: string;
  uploadedBy: { _id?: string; id?: string; firstName: string; lastName: string; role: 'admin' | 'professional' | 'patient' } | string;
  position: PhotoPosition;
  takenAt: string;
  visibility: PhotoVisibility;
  note?: string;
  mimeType: string;
  createdAt: string;
  // URL firmada y temporal (15 min): se pide de nuevo cuando vence, nunca se guarda
  url: string;
  expiresIn: number;
}
