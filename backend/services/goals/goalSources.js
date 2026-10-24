import Exercise from '../../models/Exercise.js';
import Measurement from '../../models/Measurement.js';
import EVA from '../../models/EVA.js';
import GoalCheckin from '../../models/GoalCheckin.js';
import { exerciseKey } from '../../utils/exerciseKey.js';
import { dayOf, dayNumber } from '../achievements/dates.js';
import { EVA_AREAS, getIndicator } from '../../config/goalCatalog.js';

/**
 * Lee, de los registros que el centro YA guarda, la serie de cada indicador: un valor por día, de más antiguo a más
 * reciente. No copia nada: cada lectura sale de Ejercicios, Mediciones, EVA o de los registros manuales (GoalCheckin).
 * Nunca mezcla unidades (las libras no entran), ejercicios, cargas, lados ni zonas del cuerpo.
 */

const byDay = (a, b) => dayNumber(a.day) - dayNumber(b.day) || String(a.refId).localeCompare(String(b.refId));
const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const sameLoad = (a, b) => Math.abs(a - b) < 0.001;

// Un valor por día: el mayor (fuerza) o el último registrado (medidas, dolor, registros manuales)
function reduceDaily(points, mode) {
  const map = new Map();
  for (const p of [...points].sort(byDay)) {
    const cur = map.get(p.day);
    if (!cur || (mode === 'max' ? p.value > cur.value : true)) map.set(p.day, p);
  }
  return [...map.values()].sort(byDay);
}

// Fuerza: lo que cuenta es la MEJOR marca lograda hasta cada día (una sesión liviana no hace «retroceder» tu carga máxima)
function runningBest(points) {
  let best = -Infinity;
  return points.map((p) => {
    best = Math.max(best, p.value);
    return { ...p, value: best };
  });
}

export function makeSourceReader(patientId, deps = {}) {
  const models = { Exercise, Measurement, EVA, GoalCheckin, ...deps };
  const cache = {};
  // Se guarda la PROMESA del resultado (no la consulta): una consulta de Mongoose no puede esperarse dos veces
  const lazy = (name, load) => (cache[name] ??= Promise.resolve(load()).then((rows) => rows));

  const exercises = () => lazy('exercises', () => models.Exercise.find({ patient: patientId }).select('exerciseName exerciseKey weight weightUnit reps date modality').limit(5000).lean());
  const measurements = () => lazy('measurements', () => models.Measurement.find({ patient: patientId }).select('date perimeters weight bodyFatPercentage muscleMassPercentage jumpTests').sort({ date: 1 }).limit(2000).lean());
  const evas = () => lazy('evas', () => models.EVA.find({ patient: patientId }).select('date painLevel bodyArea').sort({ date: 1 }).limit(3000).lean());
  const checkins = () => lazy('checkins', () => models.GoalCheckin.find({ patient: patientId }).select('seriesKey value unit day source createdAt').sort({ day: 1, createdAt: 1 }).lean());

  const keyOf = (e) => e.exerciseKey || exerciseKey(e.exerciseName);
  const validSet = (e) => positive(e.weight) && (e.weightUnit || 'kg') === 'kg' && positive(e.reps) && !!e.date;

  async function series(indicator) {
    const def = getIndicator(indicator.indicatorId);
    const p = indicator.params ?? {};
    switch (indicator.source) {
      case 'exercise_load': {
        const rows = (await exercises()).filter((e) => validSet(e) && keyOf(e) === p.exerciseKey);
        return runningBest(reduceDaily(rows.map((e) => ({ day: dayOf(e.date), value: e.weight, refId: String(e._id), refModel: 'ExerciseProgress' })), 'max'));
      }
      case 'exercise_reps': {
        const rows = (await exercises()).filter((e) => validSet(e) && keyOf(e) === p.exerciseKey && sameLoad(e.weight, p.loadKg));
        return runningBest(reduceDaily(rows.map((e) => ({ day: dayOf(e.date), value: e.reps, refId: String(e._id), refModel: 'ExerciseProgress' })), 'max'));
      }
      case 'measurement_perimeter': {
        const field = def?.field ?? p.field;
        const rows = (await measurements()).filter((m) => positive(m.perimeters?.[field]));
        return reduceDaily(rows.map((m) => ({ day: dayOf(m.date), value: m.perimeters[field], refId: String(m._id), refModel: 'Measurement' })), 'last');
      }
      case 'measurement_field': {
        const rows = (await measurements()).filter((m) => positive(m[def.field]));
        return reduceDaily(rows.map((m) => ({ day: dayOf(m.date), value: m[def.field], refId: String(m._id), refModel: 'Measurement' })), 'last');
      }
      case 'jump_test': {
        const rows = (await measurements()).filter((m) => positive(m.jumpTests?.[p.field]));
        return reduceDaily(rows.map((m) => ({ day: dayOf(m.date), value: m.jumpTests[p.field], refId: String(m._id), refModel: 'Measurement' })), 'last');
      }
      case 'eva': {
        const rows = (await evas()).filter((r) => r.bodyArea === p.bodyArea && Number.isFinite(r.painLevel));
        return reduceDaily(rows.map((r) => ({ day: dayOf(r.date), value: r.painLevel, refId: String(r._id), refModel: 'EVA' })), 'last');
      }
      case 'checkin': {
        const rows = (await checkins()).filter((c) => c.seriesKey === indicator.seriesKey && c.unit === indicator.unit);
        return reduceDaily(rows.map((c) => ({ day: c.day, value: c.value, refId: String(c._id), refModel: 'GoalCheckin', source: c.source })), 'last');
      }
      default:
        return [];
    }
  }

  // Lo que la persona YA tiene registrado, para sugerirlo al elegir un indicador (no pedirle medir de nuevo)
  async function suggestions() {
    const rows = (await exercises()).filter(validSet);
    const exMap = new Map();
    for (const e of rows) {
      const key = keyOf(e);
      if (!key) continue;
      const cur = exMap.get(key) ?? { key, name: e.exerciseName, days: new Set(), loads: new Set(), best: 0, last: '' };
      cur.days.add(dayOf(e.date));
      cur.loads.add(e.weight);
      cur.best = Math.max(cur.best, e.weight);
      if (dayOf(e.date) >= cur.last) { cur.last = dayOf(e.date); cur.name = e.exerciseName; }
      exMap.set(key, cur);
    }
    const ms = await measurements();
    const latest = (get) => {
      const list = ms.filter((m) => positive(get(m)));
      const m = list.at(-1);
      return m ? { value: get(m), day: dayOf(m.date), count: list.length } : null;
    };
    const perimeterFields = ['bicepFlexedLeft', 'bicepFlexedRight', 'bicepLeft', 'bicepRight', 'thighLeft', 'thighRight', 'calfLeft', 'calfRight', 'forearmLeft', 'forearmRight', 'chest', 'shoulders', 'hips', 'waist'];
    const perimeters = {};
    for (const f of perimeterFields) { const l = latest((m) => m.perimeters?.[f]); if (l) perimeters[f] = l; }
    const jumps = {};
    for (const f of ['cmj', 'sj', 'abalakov', 'dropJump', 'horizontalJump', 'cmjLeftLeg', 'cmjRightLeg', 'sjLeftLeg', 'sjRightLeg']) { const l = latest((m) => m.jumpTests?.[f]); if (l) jumps[f] = l; }
    const painAreas = {};
    for (const r of await evas()) {
      const cur = painAreas[r.bodyArea] ?? { count: 0, value: null, day: null };
      cur.count += 1; cur.value = r.painLevel; cur.day = dayOf(r.date);
      painAreas[r.bodyArea] = cur;
    }
    return {
      exercises: [...exMap.values()].map((e) => ({ key: e.key, name: e.name, sessions: e.days.size, loads: [...e.loads].sort((a, b) => b - a), bestLoadKg: e.best, lastDay: e.last })).sort((a, b) => b.lastDay.localeCompare(a.lastDay)),
      perimeters,
      weight: latest((m) => m.weight),
      bodyFatPercentage: latest((m) => m.bodyFatPercentage),
      muscleMassPercentage: latest((m) => m.muscleMassPercentage),
      jumps,
      painAreas: Object.fromEntries(Object.entries(painAreas).filter(([k]) => EVA_AREAS.some((a) => a.value === k))),
    };
  }

  return { series, suggestions };
}

// Series de todos los indicadores de una lista de objetivos, agrupadas por seriesKey
export async function seriesForGoals(goals, reader) {
  const out = {};
  for (const goal of goals) {
    for (const ind of goal.indicators) {
      if (out[ind.seriesKey]) continue;
      out[ind.seriesKey] = await reader.series(ind);
    }
  }
  return out;
}
