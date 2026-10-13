import mongoose from 'mongoose';
import Appointment from '../../models/Appointment.js';
import ClientPlan from '../../models/ClientPlan.js';
import AchievementAward from '../../models/AchievementAward.js';
import AchievementPause from '../../models/AchievementPause.js';
import WellnessCheckin from '../../models/WellnessCheckin.js';
import Measurement from '../../models/Measurement.js';
import ExerciseProgress from '../../models/Exercise.js';
import User from '../../models/User.js';
import { grantAchievement, flagForReview, restoreFromReview } from '../achievementService.js';
import { computeKinesiologyCandidates, kinesiologyMilestoneStillMet } from './kinesiology.js';
import { computeConsistencyCandidates, consistencyPeriodStillMet } from './consistency.js';
import { computeStreakCandidates, streakMilestoneStillMet } from './streaks.js';
import { computeReadinessCandidates } from './readiness.js';
import { computeWellbeingCandidates } from './wellbeing.js';
import { computeBodyCandidates, bodyMilestoneStillMet } from './body.js';
import { computeStrengthCandidates, strengthRecordStillValid, PR_NOTIFY_CAP_PER_WEEK } from './strength.js';

/**
 * Evaluación de logros de un paciente a partir de SUS datos reales.
 *
 * Se llama desde el servidor (al marcar una cita como completada, y en una pasada periódica del programador),
 * nunca desde la pantalla. Es idempotente: evaluar muchas veces deja el mismo resultado.
 */

async function loadData(patientId) {
  const id = new mongoose.Types.ObjectId(String(patientId));
  const [appointments, plans, pauses, checkins, measurements, exercises, user] = await Promise.all([
    Appointment.find({ patient: id }).select('_id type status date startTime deduction').lean(),
    ClientPlan.find({ patient: id }).select('_id serviceType sessionsTotal unlimited status startDate endDate').lean(),
    AchievementPause.find({ patient: id }).select('periodKey').lean(),
    WellnessCheckin.find({ patient: id }).select('_id date scale sleep stress').lean(),
    Measurement.find({ patient: id, weight: { $gt: 0 } }).select('_id date weight').lean(),
    ExerciseProgress.find({ patient: id, weight: { $gt: 0 } }).select('_id exerciseName date weight weightUnit reps sets').lean(),
    User.findById(id).select('preferences.bodyGoal').lean()
  ]);
  return { appointments, plans, pauses, checkins, measurements, exercises, goal: user?.preferences?.bodyGoal ?? null };
}

// Logros que corresponde conceder hoy. Cada categoría aporta los suyos; las siguientes fases agregan más.
export function computeCandidates({ appointments, plans, pauses = [], checkins = [], measurements = [], exercises = [], goal = null }, now = new Date()) {
  return [
    ...computeKinesiologyCandidates(appointments),
    ...computeConsistencyCandidates(plans, appointments),
    ...computeStreakCandidates(plans, appointments, pauses, now),
    ...computeReadinessCandidates(checkins),
    ...computeWellbeingCandidates(checkins),
    ...computeBodyCandidates(measurements, goal),
    ...computeStrengthCandidates(exercises, now)
  ];
}

// Concede lo que corresponda. Con dryRun solo informa qué concedería (para revisar antes de un backfill).
export async function evaluatePatientAchievements(patientId, { dryRun = false, now = new Date() } = {}) {
  const data = await loadData(patientId);
  const candidates = computeCandidates(data, now);
  const granted = [];
  let recentRecords = null;

  for (const candidate of candidates) {
    if (dryRun) {
      const exists = await AchievementAward.exists({ patient: patientId, key: candidate.key, periodKey: candidate.periodKey });
      if (!exists) granted.push({ key: candidate.key, periodKey: candidate.periodKey });
      continue;
    }

    // Récords de fuerza: como máximo 3 AVISOS por semana. Del tercero en adelante el logro se concede igual (queda en
    // el historial) pero sin aviso, para no saturar a quien entrena mucho.
    let notify = true;
    if (candidate.key === 'strength_pr') {
      if (recentRecords === null) {
        const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        recentRecords = await AchievementAward.countDocuments({ patient: patientId, key: 'strength_pr', createdAt: { $gte: since } });
      }
      notify = recentRecords < PR_NOTIFY_CAP_PER_WEEK;
    }

    const { created } = await grantAchievement({ patientId, ...candidate, notify });
    if (created) {
      granted.push({ key: candidate.key, periodKey: candidate.periodKey });
      if (candidate.key === 'strength_pr') recentRecords += 1;
    }
  }

  return { candidates: candidates.length, granted };
}

const REVIEW_MARK = '[auto] ';
const reviewNote = (text) => `${REVIEW_MARK}${text}`;

// Tras una corrección (una cita que dejó de estar completada, una cita borrada…): revisa los logros YA
// concedidos. Si ya no se cumplen con los datos de hoy, NO se retiran: quedan "en revisión" con una nota.
// Si una corrección posterior los vuelve a respaldar, vuelven a "activo" (solo los marcados por el sistema).
export async function reconcilePatientAchievements(patientId, { now = new Date() } = {}) {
  const data = await loadData(patientId);
  const awards = await AchievementAward.find({
    patient: patientId,
    key: { $in: ['kine_5', 'consistency_month', 'streak_3', 'streak_6', 'streak_12', 'body_1kg', 'body_3kg', 'body_5kg', 'body_10kg', 'strength_pr'] }
  });

  const flagged = [];
  const restored = [];

  for (const award of awards) {
    let stillMet;
    if (award.key === 'kine_5') stillMet = kinesiologyMilestoneStillMet(data.appointments, award.key);
    else if (award.key === 'consistency_month') stillMet = consistencyPeriodStillMet(data.plans, data.appointments, award.periodKey);
    else if (award.key.startsWith('body_')) stillMet = bodyMilestoneStillMet(data.measurements, data.goal, award.key, award.evidence?.values?.direction);
    else if (award.key === 'strength_pr') stillMet = strengthRecordStillValid(data.exercises, award.periodKey);
    else stillMet = streakMilestoneStillMet(data.plans, data.appointments, data.pauses, now, award.key);

    if (!stillMet && award.status === 'active') {
      await flagForReview({
        patientId,
        key: award.key,
        periodKey: award.periodKey,
        note: reviewNote('Un registro que respaldaba este logro se corrigió. Revisa las sesiones del paciente.')
      });
      flagged.push({ key: award.key, periodKey: award.periodKey });
    } else if (stillMet && award.status === 'under_review' && award.reviewNote?.startsWith(REVIEW_MARK)) {
      await restoreFromReview({ patientId, key: award.key, periodKey: award.periodKey });
      restored.push({ key: award.key, periodKey: award.periodKey });
    }
  }

  return { flagged, restored };
}

// Se usa desde los controladores: una falla aquí NUNCA debe tumbar la operación que la disparó (marcar una
// cita, por ejemplo). El error se registra y la pasada periódica del programador lo recupera.
export async function triggerAchievementEvaluation(patientId) {
  try {
    await evaluatePatientAchievements(patientId);
    await reconcilePatientAchievements(patientId);
  } catch (error) {
    console.error('Error evaluando logros:', error.message);
  }
}

// Pasada del programador: revisa a los pacientes con citas tocadas hace poco. Recupera lo que se haya perdido
// (servidor caído, error puntual) sin recorrer a todos los pacientes en cada vuelta.
export async function runAchievementSweep({ now = new Date(), windowDays = 3, limit = 500 } = {}) {
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  // Pacientes con citas tocadas o con un check-in nuevo en la ventana
  const [fromAppointments, fromCheckins, fromMeasurements, fromExercises] = await Promise.all([
    Appointment.distinct('patient', { updatedAt: { $gte: since } }),
    WellnessCheckin.distinct('patient', { createdAt: { $gte: since } }),
    Measurement.distinct('patient', { updatedAt: { $gte: since } }),
    ExerciseProgress.distinct('patient', { updatedAt: { $gte: since } })
  ]);
  const patientIds = [...new Map([...fromAppointments, ...fromCheckins, ...fromMeasurements, ...fromExercises].map((id) => [String(id), id])).values()];

  const summary = { patients: 0, granted: 0, flagged: 0, restored: 0, failed: 0 };
  for (const patientId of patientIds.slice(0, limit)) {
    summary.patients += 1;
    try {
      const evaluated = await evaluatePatientAchievements(patientId);
      const reconciled = await reconcilePatientAchievements(patientId);
      summary.granted += evaluated.granted.length;
      summary.flagged += reconciled.flagged.length;
      summary.restored += reconciled.restored.length;
    } catch (error) {
      summary.failed += 1;
      console.error('Error en la pasada de logros:', error.message);
    }
  }
  return summary;
}
