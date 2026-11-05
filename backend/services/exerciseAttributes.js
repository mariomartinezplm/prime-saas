/**
 * Las tres dimensiones de un ejercicio — reglas puras (sin base de datos), compartidas por el profesional y el paciente:
 *  - modalidad (cómo se mide): weight | bodyweight | time | weight_time        → ya existía (ver workoutSets.js)
 *  - ejecución (cómo se hace): normal | eccentric | isometric (+ segundos de la fase excéntrica, opcional)
 *  - implemento (con qué):     barbell | one_dumbbell | two_dumbbells | none
 * Son independientes entre sí y de la categoría (fuerza, cardio…). Los registros antiguos no los tienen y se conservan tal cual.
 * La carga SIEMPRE se guarda tal como se anotó: con dos mancuernas es el peso de CADA mancuerna (nunca se suma en silencio).
 */

export const EXECUTIONS = ['normal', 'eccentric', 'isometric'];
export const IMPLEMENTS = ['barbell', 'one_dumbbell', 'two_dumbbells', 'none'];
export const ECCENTRIC_SEC_MAX = 30;

const usesWeight = (modality) => modality === 'weight' || modality === 'weight_time';
const usesTime = (modality) => modality === 'time' || modality === 'weight_time';

const absent = (v) => v === undefined || v === null || v === '';

/**
 * Valida y normaliza los atributos de un ejercicio según su modalidad.
 * Devuelve { error } o { value: { execution?, eccentricSec?, implement? } } (solo lo que se indicó; null = «sin especificar»).
 * `modality` puede ser undefined en registros manuales antiguos: entonces solo se aplican las reglas que no dependen de ella.
 */
export function validateAttributes(input, modality) {
  const execution = absent(input?.execution) ? undefined : input.execution;
  const implement = absent(input?.implement) ? undefined : input.implement;
  const eccentricSec = absent(input?.eccentricSec) ? undefined : input.eccentricSec;

  if (execution !== undefined && !EXECUTIONS.includes(execution)) return { error: 'La ejecución debe ser normal, excéntrica o isométrica' };
  if (implement !== undefined && !IMPLEMENTS.includes(implement)) return { error: 'El implemento debe ser barra, una mancuerna, dos mancuernas o sin implemento' };

  if (execution === 'isometric' && (modality === undefined || !usesTime(modality))) {
    return { error: 'Un ejercicio isométrico se mide por tiempo, o por peso y tiempo' };
  }
  if (execution === 'eccentric' && usesTime(modality)) return { error: 'Un ejercicio excéntrico se mide por repeticiones, no por tiempo' };

  if (eccentricSec !== undefined) {
    if (execution !== 'eccentric') return { error: 'Los segundos de la fase excéntrica solo van en un ejercicio excéntrico' };
    if (!Number.isInteger(eccentricSec) || eccentricSec < 1 || eccentricSec > ECCENTRIC_SEC_MAX) return { error: `La fase excéntrica debe durar entre 1 y ${ECCENTRIC_SEC_MAX} segundos` };
  }

  if (implement !== undefined && implement !== 'none' && modality !== undefined && !usesWeight(modality)) {
    return { error: 'Este ejercicio no usa carga externa: el implemento es «sin implemento»' };
  }

  const value = {};
  if (execution !== undefined) value.execution = execution;
  if (eccentricSec !== undefined) value.eccentricSec = eccentricSec;
  if (implement !== undefined) value.implement = implement;
  return { value };
}

// Atributos que una serie hereda de su ejercicio dentro del bloque (solo los que existen)
export function attributesOf(source) {
  const out = {};
  if (source?.execution) out.execution = source.execution;
  if (source?.eccentricSec) out.eccentricSec = source.eccentricSec;
  if (source?.implement) out.implement = source.implement;
  return out;
}

/**
 * Qué registros se pueden comparar entre sí (récords, mejoras, gráficos): mismo implemento y misma ejecución.
 * Sin ejecución guardada se considera «normal» (es la forma convencional). Sin implemento guardado es un grupo aparte
 * («sin especificar»): nunca se mezcla con barra ni con mancuernas.
 */
export const comparableKey = (row) => `${row?.implement ?? 'unspecified'}|${row?.execution ?? 'normal'}`;

const MODALITIES = ['weight', 'bodyweight', 'time', 'weight_time'];
const has = (body, key) => Object.hasOwn(body ?? {}, key);

/**
 * Campos de modalidad / ejecución / implemento de un registro MANUAL (el que anota el profesional o el paciente en «Ejercicios»).
 * Mismas reglas que el entrenamiento en curso. Si el cliente no manda ninguno de estos campos (versión anterior de la pantalla),
 * no hace nada y el registro se comporta como siempre.
 * `existing` = el registro que se está corrigiendo (si lo hay). Devuelve { error } o { set: {...}, unset: [...] }.
 */
export function manualRecordFields(body, existing = null) {
  const keys = ['modality', 'durationSec', 'execution', 'eccentricSec', 'implement'];
  if (!keys.some((k) => has(body, k))) return { set: {}, unset: [] };

  const modality = has(body, 'modality') ? (absent(body.modality) ? undefined : body.modality) : existing?.modality;
  if (modality !== undefined && !MODALITIES.includes(modality)) return { error: 'Modalidad no válida' };

  const attrs = validateAttributes(
    {
      execution: has(body, 'execution') ? body.execution : existing?.execution,
      eccentricSec: has(body, 'eccentricSec') ? body.eccentricSec : existing?.eccentricSec,
      implement: has(body, 'implement') ? body.implement : existing?.implement
    },
    modality
  );
  if (attrs.error) return { error: attrs.error };

  const durationSec = has(body, 'durationSec') ? (absent(body.durationSec) ? undefined : body.durationSec) : existing?.durationSec;
  if (durationSec !== undefined && (!Number.isInteger(durationSec) || durationSec < 1 || durationSec > 7200)) {
    return { error: 'La duración debe ser un número entero de segundos entre 1 y 7200' };
  }
  const reps = has(body, 'reps') ? body.reps : existing?.reps;
  const weight = has(body, 'weight') ? body.weight : existing?.weight;
  const hasWeight = typeof weight === 'number' && weight > 0;
  const hasReps = typeof reps === 'number' && reps > 0;

  if (modality === 'time' || modality === 'weight_time') {
    if (durationSec === undefined) return { error: 'Indica la duración en segundos' };
    if (hasReps) return { error: 'Un ejercicio por tiempo no lleva repeticiones' };
  } else if (durationSec !== undefined) {
    return { error: 'Este ejercicio no se mide por tiempo' };
  }
  if (modality === 'weight_time' && !hasWeight) return { error: 'La carga debe ser mayor que 0' };
  if (modality === 'time' && hasWeight) return { error: 'Un ejercicio solo por tiempo no lleva carga externa' };
  if (modality === 'bodyweight' && hasWeight) return { error: 'Un ejercicio con peso corporal no lleva carga externa' };

  const set = {};
  const unset = [];
  const put = (field, value) => (value === undefined ? unset.push(field) : (set[field] = value));
  put('modality', modality);
  put('durationSec', durationSec);
  set.duration = durationSec ? Math.round((durationSec / 60) * 100) / 100 : undefined;
  if (set.duration === undefined) delete set.duration;
  if (!durationSec) unset.push('duration');
  put('execution', attrs.value.execution);
  put('eccentricSec', attrs.value.eccentricSec);
  put('implement', attrs.value.implement);
  return { set, unset };
}
