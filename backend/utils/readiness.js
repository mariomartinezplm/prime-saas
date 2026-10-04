/**
 * Readiness: puntaje de disposición para entrenar, a partir del check-in diario.
 *
 * Las 5 respuestas se guardan SIEMPRE en la misma dirección, 1 = mal y 9 = bien
 * (la pantalla invierte fatiga, dolor y estrés al guardarlos). Así el puntaje es
 * un promedio simple. Los check-ins antiguos venían en escala 1-5 y no tenían el
 * campo `scale`: se convierten al leerlos, sin tocar la base de datos.
 *
 * Semáforo (decisión de Mario, 2026-10-03):
 *   rojo     puntaje < 4
 *   verde    puntaje >= 7 Y ninguna respuesta muy mala
 *   amarillo todo lo demás
 * Una respuesta muy mala (<= 2) impide el verde aunque el promedio sea bueno:
 * un dolor fuerte no debe quedar escondido detrás de buen sueño y buen ánimo.
 */

export const SCALE_MAX = 9;
export const RED_BELOW = 4;
export const GREEN_FROM = 7;
export const VERY_BAD_MAX = 2;

export const READINESS_KEYS = ['sleep', 'energy', 'stress', 'soreness', 'mood'];

export const READINESS_MESSAGES = {
  green: 'Estás en buenas condiciones. Entrena como está planificado.',
  yellow: 'Hoy conviene bajar un poco la intensidad o el volumen. Escucha a tu cuerpo.',
  red: 'Hoy tu cuerpo necesita recuperarse. Habla con tu kinesiólogo antes de entrenar fuerte.'
};

// 1-5 -> 1-9 (1,2,3,4,5 -> 1,3,5,7,9). Los de escala 9 quedan igual.
export function toScale9(value, scale) {
  return scale === SCALE_MAX ? value : 1 + (value - 1) * 2;
}

export function normalizedValues(checkin) {
  const values = {};
  for (const key of READINESS_KEYS) values[key] = toScale9(checkin[key], checkin.scale);
  return values;
}

export function statusFromScore(score) {
  if (score < RED_BELOW) return 'red';
  if (score >= GREEN_FROM) return 'green';
  return 'yellow';
}

// values: las 5 respuestas ya en escala 1-9
export function computeReadiness(values) {
  const nums = READINESS_KEYS.map((key) => values[key]);
  const average = nums.reduce((sum, n) => sum + n, 0) / nums.length;
  const flags = READINESS_KEYS.filter((key) => values[key] <= VERY_BAD_MAX);

  let status = statusFromScore(average);
  if (status === 'green' && flags.length > 0) status = 'yellow';

  return {
    score: Math.round(average * 10) / 10,
    status,
    message: READINESS_MESSAGES[status],
    flags
  };
}

// Forma en que el check-in sale por la API: siempre 1-9, con su semáforo calculado
export function serializeCheckin(checkin) {
  const values = normalizedValues(checkin);
  return {
    _id: checkin._id,
    patient: checkin.patient,
    date: checkin.date,
    ...values,
    notes: checkin.notes,
    readiness: computeReadiness(values),
    createdAt: checkin.createdAt,
    updatedAt: checkin.updatedAt
  };
}

export function isValidAnswer(value) {
  return Number.isInteger(value) && value >= 1 && value <= SCALE_MAX;
}
