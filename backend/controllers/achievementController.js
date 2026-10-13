import AchievementPause from '../models/AchievementPause.js';
import User from '../models/User.js';
import { isValidPeriodKey, ONCE } from '../config/achievements.js';
import { triggerAchievementEvaluation } from '../services/achievements/index.js';

const isMonth = (periodKey) => typeof periodKey === 'string' && periodKey !== ONCE && isValidPeriodKey(periodKey);

// @desc    Pausas autorizadas de un paciente (meses neutrales para las rachas)
// @route   GET /api/achievements/patients/:patientId/pauses
// @access  Private/Staff con acceso al paciente
export const getPauses = async (req, res) => {
  try {
    const pauses = await AchievementPause.find({ patient: req.params.patientId })
      .sort({ periodKey: -1 })
      .populate('createdBy', 'firstName lastName');
    res.status(200).json({ success: true, count: pauses.length, data: { pauses } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener las pausas' });
  }
};

// @desc    Marcar un mes como pausa autorizada (lesión, vacaciones, motivos personales…)
// @route   POST /api/achievements/patients/:patientId/pauses
// @access  Private/Staff con acceso al paciente
export const createPause = async (req, res) => {
  try {
    const { periodKey, reason } = req.body;

    if (!isMonth(periodKey)) {
      return res.status(400).json({ success: false, message: 'Indica el mes con el formato AAAA-MM (por ejemplo 2026-10)' });
    }
    if (typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Indica el motivo de la pausa' });
    }

    let pause;
    try {
      pause = await AchievementPause.create({
        patient: req.params.patientId,
        periodKey,
        reason: reason.trim(),
        createdBy: req.user._id
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ success: false, message: 'Ese mes ya está marcado como pausa autorizada' });
      }
      throw error;
    }

    // Una pausa vuelve neutral un mes: puede completar una racha. Fire-and-forget (nunca tumba la respuesta).
    triggerAchievementEvaluation(req.params.patientId).catch(() => {});

    res.status(201).json({ success: true, data: { pause } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al registrar la pausa' });
  }
};

// @desc    Quitar una pausa autorizada
// @route   DELETE /api/achievements/patients/:patientId/pauses/:periodKey
// @access  Private/Staff con acceso al paciente
export const deletePause = async (req, res) => {
  try {
    if (!isMonth(req.params.periodKey)) {
      return res.status(400).json({ success: false, message: 'Mes inválido' });
    }

    const removed = await AchievementPause.findOneAndDelete({ patient: req.params.patientId, periodKey: req.params.periodKey });
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Pausa no encontrada' });
    }

    // Quitarla puede dejar sin respaldo una racha ya concedida: se revisa (queda "en revisión", nunca se borra)
    triggerAchievementEvaluation(req.params.patientId).catch(() => {});

    res.status(200).json({ success: true, message: 'Pausa eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al eliminar la pausa' });
  }
};


// ── Meta corporal (hitos de evolución de peso) ───────────────────────────────
// La define la propia persona o su profesional. Sin meta activa no se evalúa ningún hito de peso.
const DIRECTIONS = ['lose', 'gain', 'maintain'];

export const goalView = (user) => {
  const goal = user?.preferences?.bodyGoal ?? {};
  return { direction: goal.direction ?? null, enabled: goal.enabled !== false, startedAt: goal.startedAt ?? null };
};

async function readGoal(patientId, res) {
  const user = await User.findById(patientId).select('role preferences.bodyGoal');
  if (!user || user.role !== 'patient') {
    res.status(404).json({ success: false, message: 'Paciente no encontrado' });
    return null;
  }
  return user;
}

async function saveGoal(patientId, body, res) {
  const { direction, enabled } = body;

  if (direction === undefined && enabled === undefined) {
    return res.status(400).json({ success: false, message: 'Indica la meta y/o si está activada' });
  }
  if (direction !== undefined && direction !== null && !DIRECTIONS.includes(direction)) {
    return res.status(400).json({ success: false, message: 'La meta debe ser bajar, subir o mantener' });
  }
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Indica si la meta está activada o no' });
  }

  const user = await readGoal(patientId, res);
  if (!user) return;
  const current = goalView(user);

  const set = {};
  const unset = {};
  const nextDirection = direction === undefined ? current.direction : direction;
  const nextEnabled = enabled === undefined ? current.enabled : enabled;

  if (direction !== undefined) {
    if (direction === null) unset['preferences.bodyGoal.direction'] = '';
    else set['preferences.bodyGoal.direction'] = direction;
  }
  if (enabled !== undefined) set['preferences.bodyGoal.enabled'] = enabled;

  // Cambiar de meta o volver a activarla empieza una referencia nueva: se mide desde ahora
  const restarts = (direction !== undefined && direction !== current.direction) || (enabled === true && !current.enabled);
  if (nextDirection === null) unset['preferences.bodyGoal.startedAt'] = '';
  else if (restarts || !current.startedAt) set['preferences.bodyGoal.startedAt'] = new Date();

  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;

  const saved = await User.findByIdAndUpdate(patientId, update, { new: true }).select('preferences.bodyGoal');

  // Con la meta lista se evalúa de nuevo (fire-and-forget)
  if (nextEnabled && nextDirection) triggerAchievementEvaluation(patientId).catch(() => {});

  return res.status(200).json({ success: true, data: { goal: goalView(saved) } });
}

// @desc    Meta corporal del paciente autenticado
// @route   GET /api/achievements/body-goal
// @access  Private/Patient
export const getMyBodyGoal = async (req, res) => {
  try {
    const user = await readGoal(req.user._id, res);
    if (user) res.status(200).json({ success: true, data: { goal: goalView(user) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener la meta' });
  }
};

// @desc    Definir/desactivar la propia meta corporal
// @route   PUT /api/achievements/body-goal
// @access  Private/Patient
export const updateMyBodyGoal = async (req, res) => {
  try {
    await saveGoal(req.user._id, req.body, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al guardar la meta' });
  }
};

// @desc    Meta corporal de un paciente (personal con acceso al paciente)
// @route   GET /api/achievements/patients/:patientId/body-goal
// @access  Private/Staff
export const getPatientBodyGoal = async (req, res) => {
  try {
    const user = await readGoal(req.params.patientId, res);
    if (user) res.status(200).json({ success: true, data: { goal: goalView(user) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener la meta' });
  }
};

// @desc    Definir/desactivar la meta corporal de un paciente
// @route   PUT /api/achievements/patients/:patientId/body-goal
// @access  Private/Staff
export const updatePatientBodyGoal = async (req, res) => {
  try {
    await saveGoal(req.params.patientId, req.body, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al guardar la meta' });
  }
};
