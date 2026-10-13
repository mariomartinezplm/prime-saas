/**
 * Catálogo de logros de Prime F&H.
 *
 * Cada logro es una definición: qué es, a qué categoría pertenece y cómo se explica. La LÓGICA que decide si
 * se cumplió vive en los evaluadores de services/achievements/ (uno por categoría), y siempre trabaja con
 * datos reales ya registrados en la app: citas completadas, mediciones, check-ins. Nunca con suposiciones.
 *
 * Reglas aprobadas (ver STATUS.md y el plan de logros):
 *  - Un logro se concede una sola vez por (paciente, logro, periodo): lo garantiza un índice único.
 *  - Una corrección posterior NO retira un logro en silencio: lo marca "en revisión".
 *  - Las notificaciones no llevan datos clínicos ni corporales: el texto es genérico.
 *  - Los mensajes reconocen el esfuerzo: sin culpa, sin "perdiste tu racha", sin promesas médicas.
 */

export const CATEGORIES = {
  kinesiologia: { label: 'Kinesiología' },
  constancia: { label: 'Constancia en entrenamiento' },
  readiness: { label: 'Readiness diario' },
  descanso: { label: 'Sueño y descanso' },
  estres: { label: 'Estrés y recuperación' },
  trayectoria: { label: 'Trayectoria en PRIME' },
  cuerpo: { label: 'Evolución corporal' },
  fuerza: { label: 'Fuerza y rendimiento' }
};

// Texto de la notificación: SIEMPRE genérico (puede verse en pantalla bloqueada o llegar por correo).
export const GENERIC_NOTIFICATION = {
  title: 'Nuevo logro desbloqueado',
  body: 'Tienes un reconocimiento nuevo. Entra a Mis logros para verlo.',
  link: '/app/logros'
};

/**
 * Forma de una definición:
 * {
 *   key:         identificador estable (no cambia nunca una vez en producción)
 *   category:    una de CATEGORIES
 *   title:       nombre visible
 *   description: qué reconoce, en palabras simples
 *   criteria:    condición exacta, tal como se muestra a la persona
 *   message:     mensaje de celebración (sin promesas médicas ni culpa)
 *   ruleVersion: sube si cambia el criterio
 *   periodic:    true si se gana una vez por periodo mensual ('YYYY-MM'); false = una sola vez
 * }
 */
export const ACHIEVEMENTS = {
  // ── Kinesiología ────────────────────────────────────────────────────────────
  // Sesiones de kinesiología REALMENTE realizadas (estado "completada"), de por vida. No cuentan citas
  // futuras, canceladas, ausentes ni evaluaciones. Hitos futuros (10, 20…) se agregan aquí y a
  // KINESIOLOGY_MILESTONES (services/achievements/kinesiology.js).
  kine_5: {
    key: 'kine_5',
    category: 'kinesiologia',
    title: '5 sesiones completadas',
    description: 'Completaste tus primeras 5 sesiones de kinesiología.',
    criteria: 'Completar 5 sesiones de kinesiología. Solo cuentan las sesiones realizadas: no las reservas, las canceladas ni las ausencias.',
    message: '¡Primer gran hito! Has completado tus primeras 5 sesiones. Cada paso cuenta.',
    ruleVersion: 1,
    periodic: false,
    target: 5
  },

  // ── Constancia en entrenamiento ─────────────────────────────────────────────
  // Una vez por plan mensual: las sesiones completadas igualan el total de sesiones de ESE plan (8, 12…).
  // El periodo es el mes en que termina el ciclo del plan (hora de Santiago).
  consistency_month: {
    key: 'consistency_month',
    category: 'constancia',
    title: 'Mes de constancia',
    description: 'Completaste todas las sesiones de tu plan de entrenamiento de este periodo.',
    criteria: 'Completar todas las sesiones de tu plan mensual de entrenamiento (por ejemplo 8 o 12). Solo cuentan las sesiones realizadas, no las reservas.',
    message: 'Mes de constancia. Cumpliste tu plan de este periodo: tu esfuerzo se nota.',
    ruleVersion: 1,
    periodic: true
  },

  // ── Readiness diario ────────────────────────────────────────────────────────
  // Reconoce el HÁBITO de registrar el Readiness, no el resultado: no importa si fue verde, amarillo o rojo.
  readiness_week: {
    key: 'readiness_week',
    category: 'readiness',
    title: 'Una semana de Readiness',
    description: 'Registraste tu Readiness 5 días dentro de una misma semana.',
    criteria: 'Completar tu Readiness en 5 de 7 días seguidos. Solo cuenta registrarlo: no importa el resultado.',
    message: 'Una semana de Readiness. Escucharte cada día es parte de tu entrenamiento.',
    ruleVersion: 1,
    periodic: false,
    days: 5,
    window: 7
  },

  // ── Trayectoria en PRIME ────────────────────────────────────────────────────
  // Meses CONSECUTIVOS con "Mes de constancia". Un mes sin plan o con pausa autorizada no suma ni corta la
  // racha; solo un mes con plan, ya cerrado, sin llegar al objetivo y sin pausa la reinicia. Ver
  // services/achievements/streaks.js.
  streak_3: {
    key: 'streak_3',
    category: 'trayectoria',
    title: '3 meses en movimiento',
    description: 'Cumpliste tu plan de entrenamiento tres meses seguidos.',
    criteria: 'Completar las sesiones de tu plan de entrenamiento durante 3 meses consecutivos. Los meses sin plan o con una pausa autorizada no suman ni cortan la racha.',
    message: 'Tres meses en movimiento. Tu constancia está construyendo algo sólido.',
    ruleVersion: 1,
    periodic: false,
    months: 3
  },
  streak_6: {
    key: 'streak_6',
    category: 'trayectoria',
    title: '6 meses de compromiso',
    description: 'Cumpliste tu plan de entrenamiento seis meses seguidos.',
    criteria: 'Completar las sesiones de tu plan de entrenamiento durante 6 meses consecutivos. Los meses sin plan o con una pausa autorizada no suman ni cortan la racha.',
    message: 'Seis meses de compromiso. Gracias por mantener tu ritmo.',
    ruleVersion: 1,
    periodic: false,
    months: 6
  },
  streak_12: {
    key: 'streak_12',
    category: 'trayectoria',
    title: 'Un año en PRIME',
    description: 'Cumpliste tu plan de entrenamiento doce meses seguidos.',
    criteria: 'Completar las sesiones de tu plan de entrenamiento durante 12 meses consecutivos. Los meses sin plan o con una pausa autorizada no suman ni cortan la racha.',
    message: 'Un año en PRIME. Doce meses de constancia: cada sesión sumó.',
    ruleVersion: 1,
    periodic: false,
    months: 12
  }
};

export function getDefinition(key, definitions = ACHIEVEMENTS) {
  return definitions[key] || null;
}

export function listDefinitions(definitions = ACHIEVEMENTS) {
  return Object.values(definitions);
}

// Periodos: 'once' o 'YYYY-MM' (mes del plan, en hora de Santiago)
export const ONCE = 'once';
export const isValidPeriodKey = (periodKey) => periodKey === ONCE || /^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey);
