import mongoose from 'mongoose';
import Appointment from '../../models/Appointment.js';
import ClientPlan from '../../models/ClientPlan.js';
import AchievementAward from '../../models/AchievementAward.js';
import AchievementPause from '../../models/AchievementPause.js';
import { grantAchievement, flagForReview, restoreFromReview } from '../achievementService.js';
import { computeKinesiologyCandidates, kinesiologyMilestoneStillMet } from './kinesiology.js';
import { computeConsistencyCandidates, consistencyPeriodStillMet } from './consistency.js';
import { computeStreakCandidates, streakMilestoneStillMet } from './streaks.js';

/**
 * Evaluación de logros de un paciente a partir de SUS datos reales.
 *
 * Se llama desde el servidor (al marcar una cita como completada, y en una pasada periódica del programador),
 * nunca desde la pantalla. Es idempotente: evaluar muchas veces deja el mismo resultado.
 */

async function loadData(patientId) {
  const id = new mongoose.Types.ObjectId(String(patientId));
  const [appointments, plans, pauses] = await Promise.all([
    Appointment.find({ patient: id }).select('_id type status date startTime deduction').lean(),
    ClientPlan.find({ patient: id }).select('_id serviceType sessionsTotal unlimited status startDate endDate').lean(),
    AchievementPause.find({ patient: id }).select('periodKey').lean()
  ]);
  return { appointments, plans, pauses };
}

// Logros que corresponde conceder hoy. Cada categoría aporta los suyos; las siguientes fases agregan más.
export function computeCandidates({ appointments, plans, pauses = [] }, now = new Date()) {
  return [
    ...computeKinesiologyCandidates(appointments),
    ...computeConsistencyCandidates(plans, appointments),
    ...computeStreakCandidates(plans, appointments, pauses, now)
  ];
}

// Concede lo que corresponda. Con dryRun solo informa qué concedería (para revisar antes de un backfill).
export async function evaluatePatientAchievements(patientId, { dryRun = false, now = new Date() } = {}) {
  const data = await loadData(patientId);
  const candidates = computeCandidates(data, now);
  const granted = [];

  for (const candidate of candidates) {
    if (dryRun) {
      const exists = await AchievementAward.exists({ patient: patientId, key: candidate.key, periodKey: candidate.periodKey });
      if (!exists) granted.push({ key: candidate.key, periodKey: candidate.periodKey });
      continue;
    }
    const { created } = await grantAchievement({ patientId, ...candidate });
    if (created) granted.push({ key: candidate.key, periodKey: candidate.periodKey });
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
    key: { $in: ['kine_5', 'consistency_month', 'streak_3', 'streak_6', 'streak_12'] }
  });

  const flagged = [];
  const restored = [];

  for (const award of awards) {
    let stillMet;
    if (award.key === 'kine_5') stillMet = kinesiologyMilestoneStillMet(data.appointments, award.key);
    else if (award.key === 'consistency_month') stillMet = consistencyPeriodStillMet(data.plans, data.appointments, award.periodKey);
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
  const patientIds = await Appointment.distinct('patient', { updatedAt: { $gte: since } });

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
