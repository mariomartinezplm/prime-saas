import TrainingPlan from '../models/TrainingPlan.js';
import User from '../models/User.js';
import ExerciseProgress from '../models/Exercise.js';
import { canAccessPatient } from '../middleware/auth.js';
import { validatePlanInput, lastSessionBlocks } from '../services/trainingPlanRules.js';
import { dayOf } from '../services/achievements/dates.js';

/**
 * Preparar entrenamiento (Incremento 3). Una preparación es lo PLANIFICADO: vive en su propia colección y nunca crea registros de
 * ejercicio, ni marca asistencia, ni descuenta sesiones, ni mueve pagos o cupos, ni dispara récords. Escribe solo el equipo (el
 * profesional del paciente o el administrador); el paciente solo lee, y solo si la preparación es visible, sin las notas internas.
 */

const PATIENT_WINDOW_DAYS = 30;
const LIST_LIMIT = 20;

// Lo que sale hacia el paciente: sin notas internas ni datos de quién la creó
const patientView = (p) => ({
  id: String(p._id),
  forDate: p.forDate,
  title: p.title ?? null,
  blocks: p.blocks,
  createdAt: p.createdAt
});
// Lo que ve el equipo
const staffView = (p) => ({
  id: String(p._id),
  forDate: p.forDate,
  title: p.title ?? null,
  blocks: p.blocks,
  visibleToPatient: p.visibleToPatient !== false,
  internalNotes: p.internalNotes ?? '',
  createdBy: p.createdBy ? String(p.createdBy._id ?? p.createdBy) : null,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt
});

const isPatient = (req) => req.user.role === 'patient';

// @desc    Preparaciones de un paciente (el equipo ve todas; el paciente, las visibles de los últimos 30 días)
// @route   GET /api/training-plans/patient/:patientId
export const listPlans = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (isPatient(req)) {
      const since = new Date(Date.now() - PATIENT_WINDOW_DAYS * 86400000);
      const plans = await TrainingPlan.find({ patient: patientId, visibleToPatient: { $ne: false }, createdAt: { $gte: since } })
        .sort({ forDate: -1, createdAt: -1 }).limit(LIST_LIMIT).select('-internalNotes -createdBy').lean();
      return res.status(200).json({ success: true, data: { plans: plans.map(patientView) } });
    }
    const plans = await TrainingPlan.find({ patient: patientId }).sort({ forDate: -1, createdAt: -1 }).limit(LIST_LIMIT).lean();
    res.status(200).json({ success: true, data: { plans: plans.map(staffView) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudieron cargar las preparaciones' });
  }
};

// @desc    Bloques de la última sesión realizada, como borrador (no guarda nada)
// @route   GET /api/training-plans/patient/:patientId/last-session
export const getLastSession = async (req, res) => {
  try {
    const rows = await ExerciseProgress.find({ patient: req.params.patientId })
      .sort({ date: -1, createdAt: -1 }).limit(400)
      .select('exerciseName date sets reps weight weightUnit durationSec modality execution eccentricSec implement blockId slot setNumber').lean();
    const last = lastSessionBlocks(rows, dayOf);
    res.status(200).json({ success: true, data: { lastSession: last } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo cargar la última sesión' });
  }
};

// @desc    Guardar una preparación nueva
// @route   POST /api/training-plans/patient/:patientId   { clientId?, forDate, title?, blocks, internalNotes?, visibleToPatient? }
export const createPlan = async (req, res) => {
  try {
    const target = await User.findById(req.params.patientId).select('role').lean();
    if (!target || target.role !== 'patient') return res.status(404).json({ success: false, message: 'Paciente no encontrado' });
    const parsed = validatePlanInput(req.body);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    const clientId = typeof req.body.clientId === 'string' && req.body.clientId.length >= 8 && req.body.clientId.length <= 80 ? req.body.clientId : undefined;
    if (clientId) {
      const existing = await TrainingPlan.findOne({ patient: req.params.patientId, clientId }).lean();
      if (existing) return res.status(200).json({ success: true, data: { plan: staffView(existing), resumed: true } });
    }
    const plan = await TrainingPlan.create({ ...parsed.value, patient: req.params.patientId, createdBy: req.user._id, ...(clientId ? { clientId } : {}) });
    res.status(201).json({ success: true, data: { plan: staffView(plan.toObject()) } });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: 'Esta preparación ya se guardó' });
    res.status(500).json({ success: false, message: 'No se pudo guardar la preparación' });
  }
};

// Carga la preparación y verifica que el equipo tenga acceso a SU paciente (si no, «no existe»)
const ownedPlan = async (req, res) => {
  const plan = await TrainingPlan.findById(req.params.id);
  if (!plan || !(await canAccessPatient(req.user, plan.patient))) {
    res.status(404).json({ success: false, message: 'Preparación no encontrada' });
    return null;
  }
  return plan;
};

// @desc    Corregir una preparación
// @route   PUT /api/training-plans/:id
export const updatePlan = async (req, res) => {
  try {
    const plan = await ownedPlan(req, res);
    if (!plan) return;
    const parsed = validatePlanInput(req.body);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    plan.forDate = parsed.value.forDate;
    plan.blocks = parsed.value.blocks;
    plan.title = parsed.value.title;
    plan.internalNotes = parsed.value.internalNotes;
    if (parsed.value.visibleToPatient !== undefined) plan.visibleToPatient = parsed.value.visibleToPatient;
    await plan.save();
    res.status(200).json({ success: true, data: { plan: staffView(plan.toObject()) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo guardar la preparación' });
  }
};

// @desc    Eliminar una preparación (no toca ningún registro realizado)
// @route   DELETE /api/training-plans/:id
export const deletePlan = async (req, res) => {
  try {
    const plan = await ownedPlan(req, res);
    if (!plan) return;
    await plan.deleteOne();
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo eliminar la preparación' });
  }
};
