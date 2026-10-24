import mongoose from 'mongoose';
import AchievementAward from '../models/AchievementAward.js';
import { ACHIEVEMENTS, GENERIC_NOTIFICATION, ONCE, getDefinition, isValidPeriodKeyForKind, periodKindOf } from '../config/achievements.js';
import { notifyOnce } from './notificationService.js';

/**
 * Concesión de logros — la parte que NO depende de la pantalla.
 *
 * Todo es idempotente: conceder el mismo logro (mismo paciente, logro y periodo) dos veces, desde dos
 * eventos distintos o en paralelo, deja UN solo registro y UNA sola notificación.
 */

const toObjectId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)));

export const awardNotificationKey = (patientId, key, periodKey) => `achievement:${patientId}:${key}:${periodKey}`;

// Concede un logro. Devuelve { award, created }:
//   created = true  → se concedió ahora (y se avisó)
//   created = false → ya lo tenía: no se hace nada más
export async function grantAchievement(
  { patientId, key, periodKey = ONCE, awardedAt = new Date(), evidence, source = 'auto', grantedBy, reason, notify = true, seen = false },
  { definitions = ACHIEVEMENTS } = {}
) {
  const definition = getDefinition(key, definitions);
  if (!definition) throw new Error(`Logro desconocido: "${key}"`);
  const kind = periodKindOf(definition);
  if (!isValidPeriodKeyForKind(kind, periodKey)) {
    const need = { once: 'se concede una sola vez', month: 'requiere un periodo mensual', 'exercise-week': 'requiere un periodo de ejercicio y semana', goal: 'requiere un periodo de meta de peso', objective: 'requiere el identificador de un objetivo' }[kind];
    throw new Error(`El logro "${key}" ${need} (periodo recibido: "${periodKey}")`);
  }
  if (source === 'manual' && (!grantedBy || !reason?.trim())) {
    throw new Error('Un reconocimiento manual debe registrar quién lo concede y por qué');
  }

  const filter = { patient: toObjectId(patientId), key, periodKey };
  const onInsert = {
    category: definition.category,
    ruleVersion: definition.ruleVersion ?? 1,
    awardedAt,
    source,
    status: 'active',
    evidence: evidence ?? {},
    // Concesión retroactiva en silencio: queda en el historial pero sin animación de desbloqueo
    ...(seen ? { seenAt: new Date() } : {}),
    ...(source === 'manual' ? { grantedBy: toObjectId(grantedBy), reason: reason.trim() } : {})
  };

  let result;
  try {
    // $setOnInsert: si ya existe, NO se toca nada (ni la fecha ni la evidencia original)
    result = await AchievementAward.findOneAndUpdate(
      filter,
      { $setOnInsert: onInsert },
      { upsert: true, new: true, includeResultMetadata: true }
    );
  } catch (error) {
    // Dos procesos intentaron crearlo a la vez: el índice único dejó pasar solo a uno
    if (error?.code === 11000) {
      const existing = await AchievementAward.findOne(filter);
      return { award: existing, created: false };
    }
    throw error;
  }

  const award = result.value;
  const created = result.lastErrorObject?.updatedExisting === false;

  // `notify: false` concede el logro (queda en el historial) sin avisar: para no saturar con muchos avisos seguidos
  if (created && notify) {
    // Un aviso que no se pudo crear NO deshace el logro ni detiene la evaluación de los demás: el logro ya quedó
    // concedido y se ve en "Mis logros" y en la animación de desbloqueo (que no depende de la notificación).
    try {
      await notifyOnce(filter.patient, 'achievement_unlocked', {
        ...GENERIC_NOTIFICATION,
        dedupeKey: awardNotificationKey(String(filter.patient), key, periodKey)
      });
    } catch (error) {
      console.error(`No se pudo crear el aviso del logro "${key}":`, error.message);
    }
  }

  return { award, created };
}

// Una corrección posterior (p. ej. una cita que se des-completó) NO retira el logro: lo deja "en revisión"
// con una nota, para que el profesional lo vea. Nunca se borra ni se altera el historial en silencio.
export async function flagForReview({ patientId, key, periodKey = ONCE, note }) {
  return AchievementAward.findOneAndUpdate(
    { patient: toObjectId(patientId), key, periodKey, status: 'active' },
    { $set: { status: 'under_review', reviewNote: note, reviewFlaggedAt: new Date() } },
    { new: true }
  );
}

// Un logro que el sistema dejó "en revisión" vuelve a "activo" cuando una corrección posterior lo respalda otra vez.
export async function restoreFromReview({ patientId, key, periodKey = ONCE }) {
  return AchievementAward.findOneAndUpdate(
    { patient: toObjectId(patientId), key, periodKey, status: 'under_review' },
    { $set: { status: 'active' }, $unset: { reviewNote: '', reviewFlaggedAt: '' } },
    { new: true }
  );
}

export async function markSeen({ patientId, awardId }) {
  return AchievementAward.findOneAndUpdate(
    // Solo el dueño puede marcar su propio logro como visto, y solo la primera vez
    { _id: awardId, patient: toObjectId(patientId), seenAt: { $exists: false } },
    { $set: { seenAt: new Date() } },
    { new: true }
  );
}

export async function listAwards(patientId) {
  return AchievementAward.find({ patient: toObjectId(patientId) }).sort({ awardedAt: -1 });
}

// Logros concedidos cuya animación todavía no se mostró (el más antiguo primero: se muestran en orden)
export async function listUnseen(patientId) {
  return AchievementAward.find({ patient: toObjectId(patientId), seenAt: { $exists: false } }).sort({ awardedAt: 1 });
}
