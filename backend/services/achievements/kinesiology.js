/**
 * Logros de kinesiología.
 *
 * "Sesión completada" = cita de tipo kinesiología con estado `completed`. Una reserva NO es una sesión
 * realizada: las citas futuras, canceladas o ausentes (`no-show`) y las evaluaciones no cuentan.
 * Se cuenta de por vida (todas las sesiones de kinesiología del paciente, de cualquier plan).
 *
 * Para añadir un hito nuevo (10, 20 sesiones…): agregar la definición en config/achievements.js y una fila aquí.
 */

export const KINESIOLOGY_MILESTONES = [{ key: 'kine_5', target: 5 }];

const byDateThenTime = (a, b) => new Date(a.date) - new Date(b.date) || String(a.startTime ?? '').localeCompare(String(b.startTime ?? ''));

// Sesiones de kinesiología realmente realizadas, sin repetir ninguna, de la más antigua a la más reciente
export function completedKinesiology(appointments) {
  const seen = new Set();
  return appointments
    .filter((a) => a.type === 'kinesiologia' && a.status === 'completed')
    .filter((a) => {
      const id = String(a._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort(byDateThenTime);
}

// Logros que corresponde conceder con estas citas (función pura: no toca la base de datos)
export function computeKinesiologyCandidates(appointments) {
  const done = completedKinesiology(appointments);
  return KINESIOLOGY_MILESTONES.filter((m) => done.length >= m.target).map((m) => ({
    key: m.key,
    periodKey: 'once',
    evidence: {
      refs: done.slice(0, m.target).map((a) => a._id),
      refModel: 'Appointment',
      values: { completed: done.length, target: m.target },
      summary: `${m.target} sesiones de kinesiología completadas`
    }
  }));
}

// Progreso hacia el próximo hito (para la pantalla "Mis logros")
export function kinesiologyProgress(appointments) {
  const completed = completedKinesiology(appointments).length;
  const next = KINESIOLOGY_MILESTONES.find((m) => completed < m.target) ?? null;
  return { completed, nextKey: next?.key ?? null, nextTarget: next?.target ?? null };
}

// ¿Sigue cumpliéndose el hito con los datos de hoy? (para revisar tras una corrección)
export function kinesiologyMilestoneStillMet(appointments, key) {
  const milestone = KINESIOLOGY_MILESTONES.find((m) => m.key === key);
  return !!milestone && completedKinesiology(appointments).length >= milestone.target;
}
