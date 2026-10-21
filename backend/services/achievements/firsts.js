/**
 * "Primeros pasos": la primera sesión completada y el primer registro de progreso.
 *
 * Primera sesión = primera cita de kinesiología o de entrenamiento con estado `completed`. Una reserva, una cita
 * cancelada, una ausencia o una evaluación inicial no cuentan (igual que en "5 sesiones completadas").
 * Primer registro de progreso = la primera medición corporal o el primer registro de ejercicio que haya en la cuenta.
 *
 * Cada uno se concede UNA vez por paciente (índice único key + periodo 'once'): registrar o completar más cosas, o que
 * llegue el mismo evento dos veces, no repite el reconocimiento. Un registro que se borra después deja el logro "en
 * revisión", nunca se retira en silencio (ver reconcilePatientAchievements).
 *
 * Si el hecho que lo justifica es ANTIGUO (más de RETRO_DAYS días), se concede en silencio: queda en el historial con su
 * fecha real, sin aviso ni animación. Así, al activar esta función, nadie recibe de golpe reconocimientos de meses atrás.
 */

export const RETRO_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const byDate = (a, b) => new Date(a.date) - new Date(b.date) || String(a.startTime ?? '').localeCompare(String(b.startTime ?? ''));

export function firstCompletedSession(appointments) {
  return (
    appointments
      .filter((a) => a.status === 'completed' && (a.type === 'kinesiologia' || a.type === 'entrenamiento'))
      .sort(byDate)[0] ?? null
  );
}

// `firstRecords` = { measurement, exercise }: el registro MÁS ANTIGUO de cada tipo ({ _id, date }) o null
export function firstProgressRecord(firstRecords = {}) {
  const found = [
    firstRecords.measurement && { ...firstRecords.measurement, refModel: 'Measurement' },
    firstRecords.exercise && { ...firstRecords.exercise, refModel: 'ExerciseProgress' }
  ].filter(Boolean);
  return found.sort((a, b) => new Date(a.date) - new Date(b.date))[0] ?? null;
}

const isRetroactive = (date, now) => now.getTime() - new Date(date).getTime() > RETRO_DAYS * DAY_MS;

export function computeFirstsCandidates(appointments, firstRecords, now = new Date()) {
  const candidates = [];

  const session = firstCompletedSession(appointments);
  if (session) {
    candidates.push({
      key: 'first_session',
      periodKey: 'once',
      awardedAt: new Date(session.date),
      silent: isRetroactive(session.date, now),
      evidence: { refs: [session._id], refModel: 'Appointment', values: { type: session.type }, summary: 'Primera sesión completada' }
    });
  }

  const record = firstProgressRecord(firstRecords);
  if (record) {
    candidates.push({
      key: 'first_progress',
      periodKey: 'once',
      awardedAt: new Date(record.date),
      silent: isRetroactive(record.date, now),
      evidence: { refs: [record._id], refModel: record.refModel, values: { kind: record.refModel === 'Measurement' ? 'medicion' : 'ejercicio' }, summary: 'Primer registro de progreso' }
    });
  }

  return candidates;
}

// ¿Sigue habiendo datos que respalden el logro? (para revisar tras una corrección)
export function firstsStillMet(key, appointments, firstRecords) {
  if (key === 'first_session') return !!firstCompletedSession(appointments);
  if (key === 'first_progress') return !!firstProgressRecord(firstRecords);
  return false;
}
