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
  primeros: { label: 'Primeros pasos' },
  kinesiologia: { label: 'Kinesiología' },
  constancia: { label: 'Constancia en entrenamiento' },
  readiness: { label: 'Readiness diario' },
  descanso: { label: 'Sueño y descanso' },
  estres: { label: 'Estrés y recuperación' },
  trayectoria: { label: 'Trayectoria en PRIME' },
  cuerpo: { label: 'Evolución corporal' },
  fuerza: { label: 'Fuerza y rendimiento' }
};

// Orden en que se muestran las categorías en "Mis logros"
export const CATEGORY_ORDER = ['primeros', 'kinesiologia', 'constancia', 'readiness', 'descanso', 'estres', 'trayectoria', 'cuerpo', 'fuerza'];

// Retos que se mencionan pero TODAVÍA NO funcionan: se muestran como "pendientes", nunca como si ya existieran.
// `note` es lo que ve la persona (sin tecnicismos); no concede nada y no tiene progreso.
export const PENDING_ACHIEVEMENTS = [
  {
    key: 'recovery_sustained',
    category: 'estres',
    title: 'Recuperación sostenida',
    description: 'Un patrón favorable de recuperación durante varios días.',
    note: 'Pendiente: falta definir con tu centro qué significa un patrón favorable antes de activarlo.'
  },
  {
    key: 'self_care',
    category: 'estres',
    title: 'Constancia en el autocuidado',
    description: 'Completar las actividades de recuperación que definas con tu profesional.',
    note: 'Pendiente: todavía no existe el registro de actividades de recuperación acordadas con tu profesional.'
  },
  {
    key: 'device_sleep',
    category: 'descanso',
    title: 'Descanso medido con un dispositivo',
    description: 'Reconocimientos basados en la medición del sueño de un reloj o pulsera.',
    note: 'Pendiente: PRIME F&H todavía no se conecta con ningún dispositivo. Hoy el descanso se reconoce según lo que tú registras.'
  }
];

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
  // ── Primeros pasos ──────────────────────────────────────────────────────────
  // Una sola vez por paciente. Ver services/achievements/firsts.js.
  first_session: {
    key: 'first_session',
    category: 'primeros',
    title: 'Primera sesión completada',
    description: 'Completaste tu primera sesión en PRIME F&H.',
    criteria: 'Completar tu primera sesión de kinesiología o de entrenamiento. Solo cuentan las sesiones realizadas: no las reservas, las canceladas ni las ausencias.',
    message: 'Completaste tu primera sesión. Empezar es el paso más importante: gracias por confiar en nosotros.',
    ruleVersion: 1,
    periodic: false
  },
  first_progress: {
    key: 'first_progress',
    category: 'primeros',
    title: 'Primer registro de progreso',
    description: 'Guardaste tu primer registro de mediciones o de ejercicio.',
    criteria: 'Guardar tu primera medición corporal o tu primer registro de ejercicio. Registrar es lo que permite ver tu evolución con el tiempo.',
    message: 'Guardaste tu primer registro. Desde hoy tu evolución queda a la vista, a tu ritmo.',
    ruleVersion: 1,
    periodic: false
  },

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

  // ── Sueño y descanso / Estrés y recuperación ────────────────────────────────
  // FUENTE: autorreporte del Readiness (no horas de sueño ni datos de un dispositivo). 5 días favorables
  // (respuesta >= 7 de 9) dentro de una ventana de 7 días; un día sin registro no cuenta ni a favor ni en
  // contra, y nunca se concede por una sola medición. No son diagnósticos.
  rest_week: {
    key: 'rest_week',
    category: 'descanso',
    title: 'Una semana de buen descanso',
    description: 'En tu Readiness reportaste un buen descanso 5 días dentro de una misma semana.',
    criteria: 'Según lo que registras en tu Readiness (autorreporte, no una medición del sueño): una respuesta de sueño de 7 o más en 5 de 7 días. Un día sin registro no cuenta ni a favor ni en contra.',
    message: 'Una semana de buen descanso. Dormir bien también es parte de tu progreso.',
    ruleVersion: 1,
    periodic: false,
    days: 5,
    window: 7
  },
  balance_week: {
    key: 'balance_week',
    category: 'estres',
    title: 'Semana de equilibrio',
    description: 'En tu Readiness reportaste sentirte en calma 5 días dentro de una misma semana.',
    criteria: 'Según lo que registras en tu Readiness (autorreporte, no una medición fisiológica del estrés): una respuesta de calma de 7 o más en 5 de 7 días. Un día sin registro no cuenta ni a favor ni en contra.',
    message: 'Semana de equilibrio. Cuidar tu calma suma tanto como entrenar.',
    ruleVersion: 1,
    periodic: false,
    days: 5,
    window: 7
  },

  // ── Evolución corporal ──────────────────────────────────────────────────────
  // SOLO si el peso es un objetivo de la persona: ella (o su profesional con ella) elige bajar o subir Y escribe
  // cuántos kg. Sin esa meta no existe este trofeo ni se muestra nada de peso. Referencia = la última medición de
  // peso hasta el día en que empezó la meta. Se concede cuando DOS mediciones separadas por al menos 14 días
  // confirman que llegó a SU cambio (nunca por una fluctuación puntual). Cada meta nueva puede ganar su propio trofeo.
  // El texto no celebra la rapidez ni sugiere que un peso menor sea siempre mejor.
  body_goal: {
    key: 'body_goal',
    category: 'cuerpo',
    title: 'Meta de peso alcanzada',
    description: 'Alcanzaste la meta de peso que te propusiste, confirmada en dos mediciones.',
    criteria: 'Con una meta definida por ti (por ejemplo, bajar 4 kg): dos mediciones de peso, separadas por al menos 14 días, que muestren el cambio que te propusiste respecto de tu medición de referencia.',
    message: 'Meta de peso alcanzada. Es el resultado de tu constancia: felicitaciones.',
    ruleVersion: 1,
    periodKind: 'goal'
  },

  // ── Fuerza y rendimiento ────────────────────────────────────────────────────
  // Récord personal de CARGA: mayor peso en el mismo ejercicio (mismo nombre normalizado y misma unidad), con al
  // menos 3 registros previos, superando el mejor anterior en 2,5 % o más. Un aviso por ejercicio y por semana.
  strength_pr: {
    key: 'strength_pr',
    category: 'fuerza',
    title: 'Nuevo récord personal',
    description: 'Registraste una carga mayor que tu mejor marca anterior en este ejercicio.',
    criteria: 'Registrar en un ejercicio una carga al menos 2,5 % mayor que tu mejor marca anterior en ese mismo ejercicio (misma unidad), con al menos 3 registros previos. Un récord por ejercicio y por semana.',
    message: 'Nuevo récord personal. Sigue avanzando con buena técnica y según las indicaciones de tu profesional.',
    ruleVersion: 1,
    periodKind: 'exercise-week'
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

// Tipos de periodo de un logro:
//   once           una sola vez                           periodKey 'once'
//   month          una vez por mes                        periodKey 'YYYY-MM'
//   exercise-week  una vez por ejercicio y por semana     periodKey '<ejercicio>@YYYY-Www' (récords de fuerza)
//   goal           una vez por meta de peso               periodKey 'goal@<segundos del inicio de la meta>'
export const periodKindOf = (definition) => definition.periodKind ?? (definition.periodic ? 'month' : 'once');

export const isValidPeriodKeyForKind = (kind, periodKey) => {
  if (kind === 'once') return periodKey === ONCE;
  if (kind === 'month') return /^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey);
  if (kind === 'goal') return /^goal@\d{9,11}$/.test(periodKey);
  if (kind === 'exercise-week') return /^[a-z0-9-]{1,40}@\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(periodKey);
  return false;
};
