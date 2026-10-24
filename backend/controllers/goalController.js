import PatientGoal from '../models/PatientGoal.js';
import { publicCatalog } from '../config/goalCatalog.js';
import { canAccessPatient } from '../middleware/auth.js';
import { hasActivePlan } from '../services/clientPlanService.js';
import { GoalError, addCheckin, createGoal, listGoals, performAction, viewGoals } from '../services/goals/goalService.js';
import { makeSourceReader } from '../services/goals/goalSources.js';
import mongoose from 'mongoose';
import { evaluateGoalAchievements } from '../services/goals/goalAchievements.js';

// Tras cambiar una meta o registrar un valor puede completarse un objetivo: se evalúa sin frenar la respuesta (la pasada periódica lo recupera)
const reevaluate = (patientId) => evaluateGoalAchievements(patientId).catch((e) => console.error('Error evaluando objetivos:', e.message));

// Los errores de negocio (GoalError) llevan su propio código y mensaje en español; cualquier otro es un 500 sin detalles internos
function fail(res, error) {
  if (error instanceof GoalError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message, ...error.extra });
  }
  console.error('Error en objetivos:', error.message);
  return res.status(500).json({ success: false, message: 'No se pudo completar la operación' });
}

const PLAN_MESSAGE = 'Tu plan no está vigente: puedes ver tus objetivos, pero para cambiarlos o registrar avances contacta a Prime F&H.';

// Plan vencido = solo lectura para el paciente (igual que el resto de la evolución). El personal no tiene esta restricción.
async function patientWriteBlocked(req, patientId, res) {
  if (req.user.role !== 'patient') return false;
  if (String(req.user._id) !== String(patientId)) return false;
  if (await hasActivePlan(req.user._id)) return false;
  res.status(403).json({ success: false, code: 'PLAN_NOT_ACTIVE', message: PLAN_MESSAGE });
  return true;
}

// @route GET /api/goals/catalog
export const getCatalog = (_req, res) => res.status(200).json({ success: true, data: publicCatalog() });

// @route GET /api/goals/patient/:patientId   (pertenencia verificada por authorizePatientAccess)
export const getPatientGoals = async (req, res) => {
  try {
    const { patientId } = req.params;
    await reevaluate(patientId); // idempotente: deja el estado al día si un registro llegó por otro camino
    const goals = await listGoals(patientId);
    const data = await viewGoals(goals, patientId);
    res.status(200).json({ success: true, data: { goals: data, catalogVersion: publicCatalog().version } });
  } catch (error) {
    fail(res, error);
  }
};

// @route GET /api/goals/patient/:patientId/sources  → lo que la persona ya tiene registrado (para sugerirlo)
export const getPatientSources = async (req, res) => {
  try {
    const reader = makeSourceReader(req.params.patientId);
    res.status(200).json({ success: true, data: await reader.suggestions() });
  } catch (error) {
    fail(res, error);
  }
};

// @route POST /api/goals/patient/:patientId
export const createPatientGoal = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (await patientWriteBlocked(req, patientId, res)) return;
    const goal = await createGoal(patientId, req.user, req.body ?? {});
    const [view] = await viewGoals([goal], patientId);
    res.status(201).json({ success: true, data: { goal: view } });
  } catch (error) {
    fail(res, error);
  }
};

// Carga el objetivo y comprueba que quien pide pueda ver a ese paciente (404 si no: no se revela que existe)
async function loadGoal(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.goalId)) {
    res.status(404).json({ success: false, message: 'Recurso no encontrado' });
    return null;
  }
  const goal = await PatientGoal.findById(req.params.goalId);
  if (!goal || !(await canAccessPatient(req.user, goal.patient))) {
    res.status(404).json({ success: false, message: 'Recurso no encontrado' });
    return null;
  }
  return goal;
}

// @route POST /api/goals/:goalId/action   { action: pause | resume | discard | validate | update_target | update_settings, ... }
export const actOnGoal = async (req, res) => {
  try {
    const goal = await loadGoal(req, res);
    if (!goal) return;
    if (await patientWriteBlocked(req, goal.patient, res)) return;
    await performAction(goal, req.user, req.body ?? {});
    if (['validate', 'update_target', 'resume'].includes(req.body?.action)) await reevaluate(goal.patient);
    const [view] = await viewGoals([(await PatientGoal.findById(goal._id)) ?? goal], goal.patient);
    res.status(200).json({ success: true, data: { goal: view } });
  } catch (error) {
    fail(res, error);
  }
};

// @route POST /api/goals/:goalId/checkins   { seriesKey, value, day?, note?, clientId? }
export const createGoalCheckin = async (req, res) => {
  try {
    const goal = await loadGoal(req, res);
    if (!goal) return;
    if (await patientWriteBlocked(req, goal.patient, res)) return;
    await addCheckin(goal, req.user, req.body ?? {});
    await reevaluate(goal.patient);
    const [view] = await viewGoals([(await PatientGoal.findById(goal._id)) ?? goal], goal.patient);
    res.status(201).json({ success: true, data: { goal: view } });
  } catch (error) {
    fail(res, error);
  }
};
