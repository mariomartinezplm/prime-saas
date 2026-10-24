import { DIRECTIONS, MAX_INDICATORS_PER_GOAL, getCategory, getIndicator } from '../../config/goalCatalog.js';

/**
 * Reglas puras de los objetivos (sin base de datos): validar lo que la persona eligió contra el catálogo, decidir si
 * necesita validación profesional y repartir los 3 cupos (1 principal + 2 secundarios).
 */

export const ACTIVE_STATUSES = ['active', 'pending_validation']; // ocupan cupo
export const CLOSED_STATUSES = ['paused', 'achieved', 'discarded']; // no ocupan cupo y conservan su historial
export const PRIMARY_SLOT = 1;
export const SECONDARY_SLOTS = [2, 3];

// Identidad de la serie de registros manuales de un indicador: «indicador|parámetro=valor|…» (parámetros ordenados).
// Dos objetivos con el mismo indicador y los mismos parámetros comparten sus registros: nada se duplica.
export function seriesKeyOf(indicatorId, params = {}, unit = '') {
  const parts = Object.keys(params).sort().map((k) => `${k}=${String(params[k]).trim().toLowerCase()}`);
  return [indicatorId, ...parts, ...(unit ? [`unit=${unit}`] : [])].join('|');
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// «32,5» o «32.5» → 32.5 (el navegador ya lo envía como número; esto protege a quien llame al servidor con texto)
export function toNumber(v) {
  if (isNum(v)) return v;
  if (typeof v !== 'string') return null;
  const clean = v.trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(clean) ? Number(clean) : null;
}

function validateParams(indicator, rawParams, errors, prefix) {
  const out = {};
  const given = rawParams && typeof rawParams === 'object' ? rawParams : {};
  const known = new Set(indicator.params.map((p) => p.key));
  for (const key of Object.keys(given)) {
    if (!known.has(key)) errors.push(`${prefix}: el parámetro «${key}» no corresponde a este indicador`);
  }
  for (const def of indicator.params) {
    const value = given[def.key];
    const missing = value === undefined || value === null || value === '';
    if (missing) {
      if (def.required) errors.push(`${prefix}: falta «${def.label}»`);
      continue;
    }
    if (def.type === 'enum') {
      if (!def.options.some((o) => o.value === value)) errors.push(`${prefix}: «${def.label}» no es una opción válida`);
      else out[def.key] = value;
    } else if (def.type === 'number') {
      const n = toNumber(value);
      if (n === null || n < def.min || n > def.max) errors.push(`${prefix}: «${def.label}» debe estar entre ${def.min} y ${def.max}`);
      else out[def.key] = n;
    } else if (def.type === 'text') {
      const text = String(value).trim();
      if (!text || text.length > (def.max ?? 60)) errors.push(`${prefix}: «${def.label}» debe tener entre 1 y ${def.max ?? 60} caracteres`);
      else out[def.key] = text;
    } else if (def.type === 'exercise') {
      const key = String(value).trim().toLowerCase();
      if (!/^[a-z0-9 ]{1,80}$/.test(key)) errors.push(`${prefix}: «${def.label}» no es válido`);
      else out[def.key] = key;
    }
  }
  return out;
}

/**
 * Valida UN indicador elegido para una categoría. `input`: { indicatorId, params, unit?, direction?, target?: { value, tolerance? } }.
 * Devuelve { ok, errors, indicator } con el indicador normalizado (listo para guardar), o los errores en español.
 */
export function validateIndicatorInput(categoryId, input, position = 1) {
  const errors = [];
  const prefix = `Indicador ${position}`;
  const category = getCategory(categoryId);
  if (!category || !category.active) return { ok: false, errors: ['La categoría de objetivo no existe o no está disponible'] };
  const def = getIndicator(input?.indicatorId);
  if (!def || !category.indicators.includes(def.id)) return { ok: false, errors: [`${prefix}: el indicador no corresponde a esta categoría`] };

  const params = validateParams(def, input.params, errors, prefix);

  let unit = def.unit;
  if (def.unitOptions) {
    if (!def.unitOptions.includes(input.unit)) errors.push(`${prefix}: elige una unidad válida (${def.unitOptions.join(', ')})`);
    else unit = input.unit;
  }

  const direction = input.direction ?? def.defaultDirection;
  if (!DIRECTIONS.includes(direction) || !def.directions.includes(direction)) errors.push(`${prefix}: la dirección elegida no corresponde a este indicador`);

  let target = null;
  const rawTarget = input.target;
  if (rawTarget && rawTarget.value !== undefined && rawTarget.value !== null && rawTarget.value !== '') {
    const value = toNumber(rawTarget.value);
    if (value === null || value < def.range.min || value > def.range.max) {
      errors.push(`${prefix}: la meta debe estar entre ${def.range.min} y ${def.range.max} ${unit}`);
    } else {
      target = { value };
      if (direction === 'maintain') {
        const tolerance = toNumber(rawTarget.tolerance);
        if (tolerance === null || tolerance <= 0 || tolerance > (def.range.max - def.range.min) / 2) errors.push(`${prefix}: para mantener un valor indica cuánto margen aceptas (mayor que 0)`);
        else target.tolerance = tolerance;
      }
    }
  }
  // Sin meta todavía es válido para cualquier indicador: el objetivo queda «por definir la meta» y la persona (o su
  // kinesiólogo) la pone después. Un objetivo que exige validación clínica no se activa sin metas (ver createGoal).

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    indicator: {
      indicatorId: def.id,
      label: def.label,
      source: def.source,
      unit,
      params,
      direction,
      seriesKey: seriesKeyOf(def.id, params, def.unitOptions ? unit : ''),
      target,
      origin: def.origin,
    },
  };
}

// Valida la lista completa de indicadores de un objetivo
export function validateGoalInput(input) {
  const category = getCategory(input?.categoryId);
  if (!category || !category.active) return { ok: false, errors: ['La categoría de objetivo no existe o no está disponible'] };
  const list = Array.isArray(input.indicators) ? input.indicators : [];
  if (list.length === 0) return { ok: false, errors: ['Elige al menos un indicador para seguir tu avance'] };
  if (list.length > MAX_INDICATORS_PER_GOAL) return { ok: false, errors: [`Un objetivo admite hasta ${MAX_INDICATORS_PER_GOAL} indicadores`] };
  if (list.length > 1 && !category.multiIndicator) return { ok: false, errors: ['Esta categoría admite un solo indicador por objetivo'] };

  const indicators = [];
  const errors = [];
  const seen = new Set();
  list.forEach((item, i) => {
    const r = validateIndicatorInput(category.id, item, i + 1);
    if (!r.ok) {
      errors.push(...r.errors);
    } else if (seen.has(r.indicator.seriesKey)) {
      errors.push(`Indicador ${i + 1}: ya lo elegiste en este objetivo`);
    } else {
      seen.add(r.indicator.seriesKey);
      indicators.push(r.indicator);
    }
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], category, indicators };
}

// ¿La meta necesita que la valide un profesional antes de activarse? Categorías clínicas (postura, dolor, movilidad) o cualquier
// indicador clínico (presión, glucosa, colesterol: no hay valores universales). Una categoría «recomendada» NO lo exige.
export function requiresValidation(category, indicators) {
  if (category.supervision === 'required') return true;
  return indicators.some((ind) => getIndicator(ind.indicatorId)?.clinical === true);
}

// ¿Todas las metas clínicas ya tienen valor? (para poder validar)
export const hasAllTargets = (indicators) => indicators.every((ind) => ind.target && isNum(ind.target.value));

/**
 * Reparte los cupos. `taken`: cupos ocupados (1 = principal; 2 y 3 = secundarios). `priority`: 'primary' | 'secondary'.
 * Devuelve { slot } o { error: 'PRIMARY_TAKEN' | 'SECONDARY_FULL' }.
 */
export function allocateSlot(taken, priority) {
  const used = new Set(taken);
  if (priority === 'primary') return used.has(PRIMARY_SLOT) ? { error: 'PRIMARY_TAKEN' } : { slot: PRIMARY_SLOT };
  if (priority === 'secondary') {
    const free = SECONDARY_SLOTS.find((s) => !used.has(s));
    return free ? { slot: free } : { error: 'SECONDARY_FULL' };
  }
  return { error: 'BAD_PRIORITY' };
}
