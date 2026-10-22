import AchievementPause from '../models/AchievementPause.js';
import User from '../models/User.js';
import { isValidPeriodKey, ONCE } from '../config/achievements.js';
import mongoose from 'mongoose';
import AchievementAward from '../models/AchievementAward.js';
import { ACHIEVEMENTS, CATEGORIES } from '../config/achievements.js';
import { markSeen } from '../services/achievementService.js';
import { triggerAchievementEvaluation, getAchievementsOverview, getMonthlySummary } from '../services/achievements/index.js';
import { validateMonth } from '../services/achievements/monthly.js';

// Las pausas y los logros son de PACIENTES: un id de otro rol (o inexistente) responde 404 sin tocar nada
async function ensurePatient(patientId, res) {
  const user = await User.findById(patientId).select('role');
  if (!user || user.role !== 'patient') {
    res.status(404).json({ success: false, message: 'Paciente no encontrado' });
    return false;
  }
  return true;
}

const isMonth = (periodKey) => typeof periodKey === 'string' && periodKey !== ONCE && isValidPeriodKey(periodKey);

// @desc    Pausas autorizadas de un paciente (meses neutrales para las rachas)
// @route   GET /api/achievements/patients/:patientId/pauses
// @access  Private/Staff con acceso al paciente
export const getPauses = async (req, res) => {
  try {
    if (!(await ensurePatient(req.params.patientId, res))) return;
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
    if (!(await ensurePatient(req.params.patientId, res))) return;

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
    if (!(await ensurePatient(req.params.patientId, res))) return;

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


// ── Meta de peso ─────────────────────────────────────────────────────────────
// La define la propia persona (o su profesional con ella): bajar o subir Y cuántos kg. Si el peso no le interesa, no
// hay meta y no se evalúa ni se muestra nada de peso.
const DIRECTIONS = ['lose', 'gain'];
export const MIN_TARGET_KG = 0.5;
export const MAX_TARGET_KG = 100;
const round1 = (n) => Math.round(n * 10) / 10;

export const goalView = (user) => {
  const goal = user?.preferences?.bodyGoal ?? {};
  return { direction: goal.direction ?? null, targetKg: goal.targetKg ?? null, enabled: goal.enabled !== false, startedAt: goal.startedAt ?? null };
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
  let { targetKg } = body;

  if (direction === undefined && targetKg === undefined && enabled === undefined) {
    return res.status(400).json({ success: false, message: 'Indica la meta, los kg y/o si está activada' });
  }
  if (direction !== undefined && direction !== null && !DIRECTIONS.includes(direction)) {
    return res.status(400).json({ success: false, message: 'La meta debe ser bajar o subir de peso' });
  }
  if (targetKg !== undefined && targetKg !== null) {
    if (typeof targetKg !== 'number' || !Number.isFinite(targetKg) || targetKg < MIN_TARGET_KG || targetKg > MAX_TARGET_KG) {
      return res.status(400).json({ success: false, message: `Los kg de tu meta deben estar entre ${MIN_TARGET_KG} y ${MAX_TARGET_KG}` });
    }
    targetKg = round1(targetKg);
  }
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Indica si la meta está activada o no' });
  }

  const user = await readGoal(patientId, res);
  if (!user) return;
  const current = goalView(user);

  // Quitar la meta (dirección null) borra también los kg: sin meta, el peso no es un objetivo
  const nextDirection = direction === undefined ? current.direction : direction;
  const nextTarget = direction === null ? null : targetKg === undefined ? current.targetKg : targetKg;
  const nextEnabled = enabled === undefined ? current.enabled : enabled;
  const complete = !!nextDirection && nextTarget !== null;

  const set = {};
  const unset = {};
  if (nextDirection) set['preferences.bodyGoal.direction'] = nextDirection;
  else unset['preferences.bodyGoal.direction'] = '';
  if (nextTarget !== null) set['preferences.bodyGoal.targetKg'] = nextTarget;
  else unset['preferences.bodyGoal.targetKg'] = '';
  if (enabled !== undefined) set['preferences.bodyGoal.enabled'] = enabled;

  // Cambiar la dirección o los kg, o volver a activarla, empieza una meta NUEVA: referencia nueva y trofeo propio.
  // Sin meta completa (falta la dirección o los kg) no hay inicio todavía.
  const restarts = nextDirection !== current.direction || nextTarget !== current.targetKg || (enabled === true && !current.enabled);
  if (!complete) unset['preferences.bodyGoal.startedAt'] = '';
  else if (restarts || !current.startedAt) set['preferences.bodyGoal.startedAt'] = new Date();

  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;

  const saved = await User.findByIdAndUpdate(patientId, update, { new: true }).select('preferences.bodyGoal');

  // Con la meta completa y activa se evalúa de nuevo (fire-and-forget)
  if (nextEnabled && complete) triggerAchievementEvaluation(patientId).catch(() => {});

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


// ── Objetivo semanal (Mi camino PRIME) ───────────────────────────────────────
export const MAX_WEEKLY_GOAL = 7;

// @desc    Fijar (o quitar, con sessions: null) el objetivo semanal de entrenamiento de un paciente
// @route   PUT /api/achievements/patients/:patientId/weekly-goal   { sessions: 1..7 | null }
// @access  Private/Staff (el acceso al paciente lo verifica la ruta)
export const updatePatientWeeklyGoal = async (req, res) => {
  try {
    const { sessions } = req.body ?? {};
    const valid = sessions === null || (Number.isInteger(sessions) && sessions >= 1 && sessions <= MAX_WEEKLY_GOAL);
    if (!valid) {
      return res.status(400).json({ success: false, message: `El objetivo semanal debe ser un número entero de sesiones entre 1 y ${MAX_WEEKLY_GOAL}, o null para volver al valor por defecto` });
    }
    const user = await User.findById(req.params.patientId).select('role');
    if (!user || user.role !== 'patient') {
      return res.status(404).json({ success: false, message: 'Paciente no encontrado' });
    }
    const update =
      sessions === null
        ? { $unset: { 'preferences.weeklyGoal': '' } }
        : { $set: { 'preferences.weeklyGoal': { sessions, setBy: req.user._id, setAt: new Date() } } };
    await User.updateOne({ _id: user._id }, update);
    res.status(200).json({ success: true, message: sessions === null ? 'Objetivo semanal por defecto' : 'Objetivo semanal guardado', data: { sessions } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo guardar el objetivo semanal' });
  }
};

// ── "Mis logros" ─────────────────────────────────────────────────────────────

// @desc    Mis logros: categorías, retos, progreso, historial y próximo hito (solo los del propio paciente)
// @route   GET /api/achievements/me
// @access  Private/Patient
export const getMyAchievements = async (req, res) => {
  try {
    const overview = await getAchievementsOverview(req.user._id, { audience: 'patient' });
    res.status(200).json({ success: true, data: overview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener tus logros' });
  }
};

// @desc    Resumen mensual de Mi camino PRIME (solo lo registrado, sin interpretaciones; solo el propio paciente)
// @route   GET /api/achievements/me/monthly/:month   (AAAA-MM, no futuro, hasta 24 meses atrás)
// @access  Private/Patient
export const getMyMonthly = async (req, res) => {
  try {
    const { month } = req.params;
    if (!validateMonth(month)) {
      return res.status(400).json({ success: false, message: 'El mes debe tener el formato AAAA-MM, no ser futuro y no tener más de 24 meses' });
    }
    const summary = await getMonthlySummary(req.user._id, month);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo obtener tu resumen mensual' });
  }
};

// @desc    Logros todavía no mostrados con la animación (liviano: solo lee los logros concedidos)
// @route   GET /api/achievements/me/unseen
// @access  Private/Patient
export const getMyUnseen = async (req, res) => {
  try {
    const awards = await AchievementAward.find({ patient: req.user._id, seenAt: { $exists: false } }).sort({ awardedAt: 1 }).limit(10).lean();
    const unseen = awards
      .filter((a) => ACHIEVEMENTS[a.key])
      .map((a) => ({
        id: String(a._id),
        key: a.key,
        title: ACHIEVEMENTS[a.key].title,
        message: ACHIEVEMENTS[a.key].message,
        category: a.category,
        categoryLabel: CATEGORIES[a.category]?.label ?? '',
        awardedAt: a.awardedAt,
        // Solo para «Nueva marca personal»: lo que se muestra en la celebración (ejercicio, marca anterior y nueva)
        record: a.key === 'strength_pr' && a.evidence?.values?.exercise
          ? { exercise: a.evidence.values.exercise, previous: a.evidence.values.previousBest ?? null, current: a.evidence.values.weight ?? null, unit: a.evidence.values.unit ?? 'kg' }
          : undefined
      }));
    res.status(200).json({ success: true, data: { unseen } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener tus logros nuevos' });
  }
};

// @desc    Marcar un logro como visto (la animación no vuelve a aparecer, tampoco en otro dispositivo)
// @route   POST /api/achievements/me/:awardId/seen
// @access  Private/Patient (solo sus propios logros)
export const markMyAchievementSeen = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.awardId)) {
      return res.status(400).json({ success: false, message: 'Logro no válido' });
    }
    // Idempotente: si ya estaba visto, o no es del paciente, no cambia nada y responde igual
    await markSeen({ patientId: req.user._id, awardId: req.params.awardId });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al marcar el logro' });
  }
};

// @desc    Logros de un paciente con la evidencia y el estado de revisión (personal con acceso al paciente)
// @route   GET /api/achievements/patients/:patientId
// @access  Private/Staff
export const getPatientAchievements = async (req, res) => {
  try {
    const { patientId } = req.params;
    const user = await readGoal(patientId, res);
    if (!user) return;

    const [overview, pauses] = await Promise.all([
      getAchievementsOverview(patientId, { audience: 'staff' }),
      AchievementPause.find({ patient: patientId }).sort({ periodKey: -1 }).populate('createdBy', 'firstName lastName').lean()
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...overview,
        goal: goalView(user),
        pauses,
        // Logros que quedaron "en revisión" tras una corrección: el personal los revisa, nunca se borran solos
        reviewCount: overview.history.filter((h) => h.status === 'under_review').length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener los logros del paciente' });
  }
};
