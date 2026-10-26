/**
 * PRUEBAS — Reglas de los objetivos: validación contra el catálogo, cupos (1 principal + 2 secundarios) y validación profesional.
 */
import { describe, it, expect } from 'vitest';
import { validateIndicatorInput, validateGoalInput, allocateSlot, requiresValidation, seriesKeyOf, toNumber, hasAllTargets } from '../services/goals/goalRules.js';
import { getCategory } from '../config/goalCatalog.js';

describe('decimales', () => {
  it('acepta coma o punto y rechaza texto', () => {
    expect(toNumber('32,5')).toBe(32.5);
    expect(toNumber('32.5')).toBe(32.5);
    expect(toNumber(7)).toBe(7);
    expect(toNumber('abc')).toBeNull();
    expect(toNumber('1,2,3')).toBeNull();
  });
});

describe('validar un indicador', () => {
  const press = { indicatorId: 'exercise_max_load', params: { exerciseKey: 'Press Banca' }, target: { value: 75 } };
  it('fuerza: ejercicio + meta en kg → normalizado con su clave de serie', () => {
    const r = validateIndicatorInput('strength', press);
    expect(r.ok).toBe(true);
    expect(r.indicator).toMatchObject({ indicatorId: 'exercise_max_load', unit: 'kg', direction: 'increase', params: { exerciseKey: 'press banca' }, target: { value: 75 } });
    expect(r.indicator.seriesKey).toBe('exercise_max_load|exerciseKey=press banca');
  });
  it('rechaza un indicador de otra categoría, parámetros que sobran o faltan', () => {
    expect(validateIndicatorInput('strength', { indicatorId: 'body_weight', target: { value: 70 } }).ok).toBe(false);
    expect(validateIndicatorInput('strength', { ...press, params: {} }).errors[0]).toMatch(/falta/);
    expect(validateIndicatorInput('strength', { ...press, params: { exerciseKey: 'x', extra: 1 } }).ok).toBe(false);
  });
  it('rechaza metas fuera de rango y direcciones que no corresponden; sin meta es válido (se define después)', () => {
    expect(validateIndicatorInput('strength', { ...press, target: { value: 5000 } }).ok).toBe(false);
    const sinMeta = validateIndicatorInput('strength', { ...press, target: undefined });
    expect(sinMeta.ok).toBe(true);
    expect(sinMeta.indicator.target).toBeNull();
    expect(validateIndicatorInput('strength', { ...press, direction: 'decrease' }).ok).toBe(false);
    expect(validateIndicatorInput('nope', press).ok).toBe(false);
  });
  it('bíceps contraído derecho: el lado se elige de la lista (no se mezcla con el relajado ni con otra zona)', () => {
    const ok = validateIndicatorInput('muscle_mass', { indicatorId: 'perimeter_bicep_flexed', params: { field: 'bicepFlexedRight' }, target: { value: 37 } });
    expect(ok.ok).toBe(true);
    expect(ok.indicator.seriesKey).toBe('perimeter_bicep_flexed|field=bicepflexedright');
    expect(validateIndicatorInput('muscle_mass', { indicatorId: 'perimeter_bicep_flexed', params: { field: 'bicepsCualquiera' }, target: { value: 37 } }).ok).toBe(false);
    expect(validateIndicatorInput('muscle_mass', { indicatorId: 'perimeter_bicep_flexed', params: { field: 'thighLeft' }, target: { value: 37 } }).ok).toBe(false);
  });
  it('muslo y glúteos se miden sin mezclar lados; glúteos no lleva lado', () => {
    expect(validateIndicatorInput('muscle_mass', { indicatorId: 'perimeter_thigh', params: { field: 'thighLeft' } }).ok).toBe(true);
    expect(validateIndicatorInput('muscle_mass', { indicatorId: 'perimeter_glute' }).ok).toBe(true);
    expect(validateIndicatorInput('muscle_mass', { indicatorId: 'perimeter_glute', params: { field: 'hips' } }).ok).toBe(false);
  });
  it('lo que ya no se ofrece no se puede elegir en un objetivo nuevo (pero sigue definido para los antiguos)', () => {
    const viejos = [['muscle_mass', 'perimeter_muscle', { field: 'bicepFlexedRight' }], ['muscle_mass', 'muscle_mass_pct'], ['cardiometabolic', 'resting_heart_rate', { method: 'manual' }], ['cardiometabolic', 'weekly_activity_minutes'], ['stress', 'sleep_hours'], ['posture', 'posture_functional_test', { testName: 'x' }], ['mobility', 'rom_degrees'], ['mobility', 'mobility_test']];
    for (const [cat, indicatorId, params] of viejos) expect(validateIndicatorInput(cat, { indicatorId, params }).ok, indicatorId).toBe(false);
  });
  it('las escalas respetan su rango: postura y movilidad de 1 a 10, estrés de 0 a 10', () => {
    expect(validateIndicatorInput('posture', { indicatorId: 'posture_self_rating', target: { value: 8 } }).ok).toBe(true);
    expect(validateIndicatorInput('posture', { indicatorId: 'posture_self_rating', target: { value: 0 } }).ok).toBe(false);
    expect(validateIndicatorInput('mobility', { indicatorId: 'mobility_self_rating', target: { value: 11 } }).ok).toBe(false);
    expect(validateIndicatorInput('stress', { indicatorId: 'stress_perceived', target: { value: 0 } }).ok).toBe(true);
  });
  it('cardio: triglicéridos es un indicador propio y el colesterol ya no lo mezcla como fracción', () => {
    expect(validateIndicatorInput('cardiometabolic', { indicatorId: 'triglycerides' }).ok).toBe(true);
    expect(validateIndicatorInput('cardiometabolic', { indicatorId: 'cholesterol', params: { analyte: 'triglycerides' } }).ok).toBe(false);
    expect(validateIndicatorInput('cardiometabolic', { indicatorId: 'cholesterol', params: { analyte: 'ldl' } }).ok).toBe(true);
  });
  it('rendimiento: ritmo por kilómetro (baja) y cómo me siento en mi deporte (1 a 10)', () => {
    const pace = validateIndicatorInput('sport_performance', { indicatorId: 'running_pace', target: { value: 5.5 } });
    expect(pace.ok).toBe(true);
    expect(pace.indicator).toMatchObject({ direction: 'decrease', unit: 'min/km' });
    expect(validateIndicatorInput('sport_performance', { indicatorId: 'sport_self_rating', target: { value: 9 } }).ok).toBe(true);
  });
  it('mantener exige un margen mayor que 0', () => {
    const base = { indicatorId: 'body_weight', direction: 'maintain' };
    expect(validateIndicatorInput('weight', { ...base, target: { value: 80 } }).ok).toBe(false);
    expect(validateIndicatorInput('weight', { ...base, target: { value: 80, tolerance: 2 } }).indicator.target).toEqual({ value: 80, tolerance: 2 });
  });
  it('una prueba propia elige su unidad: tiempo baja, distancia sube, y la unidad entra en la clave', () => {
    const t = { indicatorId: 'performance_test', params: { testName: '1 km' }, unit: 's', direction: 'decrease', target: { value: 270 } };
    const r = validateIndicatorInput('sport_performance', t);
    expect(r.ok).toBe(true);
    expect(r.indicator.seriesKey).toBe('performance_test|testName=1 km|unit=s');
    expect(validateIndicatorInput('sport_performance', { ...t, unit: 'furlong' }).ok).toBe(false);
  });
  it('los indicadores clínicos pueden quedar sin meta: la define el profesional', () => {
    const r = validateIndicatorInput('cardiometabolic', { indicatorId: 'glucose', params: { context: 'fasting', method: 'lab' } });
    expect(r.ok).toBe(true);
    expect(r.indicator.target).toBeNull();
  });
});

describe('validar un objetivo completo', () => {
  const weekly = { indicatorId: 'glucose', params: { context: 'fasting', method: 'lab' }, direction: 'decrease', target: { value: 95 } };
  const rate = { indicatorId: 'triglycerides', direction: 'decrease', target: { value: 150 } };
  it('corazón y metabolismo admite varios indicadores en un solo objetivo', () => {
    expect(validateGoalInput({ categoryId: 'cardiometabolic', indicators: [weekly, rate] }).ok).toBe(true);
  });
  it('masa muscular admite bíceps, muslo y glúteos en un mismo objetivo', () => {
    const list = [{ indicatorId: 'perimeter_bicep_flexed', params: { field: 'bicepFlexedLeft' } }, { indicatorId: 'perimeter_thigh', params: { field: 'thighRight' } }, { indicatorId: 'perimeter_glute' }];
    expect(validateGoalInput({ categoryId: 'muscle_mass', indicators: list }).ok).toBe(true);
  });
  it('una categoría de un solo indicador rechaza varios; no se repite un indicador; hay un tope', () => {
    const one = { indicatorId: 'body_weight', target: { value: 80 } };
    expect(validateGoalInput({ categoryId: 'weight', indicators: [one, one] }).ok).toBe(false);
    expect(validateGoalInput({ categoryId: 'cardiometabolic', indicators: [weekly, weekly] }).errors[0]).toMatch(/ya lo elegiste/);
    expect(validateGoalInput({ categoryId: 'weight', indicators: [] }).ok).toBe(false);
  });
});

describe('seriesKey', () => {
  it('es estable sin importar el orden de los parámetros', () => {
    expect(seriesKeyOf('x', { b: 1, a: 'Q' })).toBe(seriesKeyOf('x', { a: 'q', b: 1 }));
  });
});

describe('cupos: 1 principal y 2 secundarios', () => {
  it('reparte principal y luego dos secundarios', () => {
    expect(allocateSlot([], 'primary')).toEqual({ slot: 1 });
    expect(allocateSlot([1], 'secondary')).toEqual({ slot: 2 });
    expect(allocateSlot([1, 2], 'secondary')).toEqual({ slot: 3 });
  });
  it('rechaza una segunda principal y un cuarto objetivo', () => {
    expect(allocateSlot([1], 'primary')).toEqual({ error: 'PRIMARY_TAKEN' });
    expect(allocateSlot([1, 2, 3], 'secondary')).toEqual({ error: 'SECONDARY_FULL' });
  });
  it('al pausar un objetivo su cupo queda libre', () => {
    expect(allocateSlot([2, 3], 'primary')).toEqual({ slot: 1 });
    expect(allocateSlot([1, 3], 'secondary')).toEqual({ slot: 2 });
  });
});

describe('qué objetivos necesitan validación profesional', () => {
  const ind = (id) => ({ indicatorId: id });
  it('dolor, postura y movilidad siempre', () => {
    for (const id of ['pain', 'posture', 'mobility']) expect(requiresValidation(getCategory(id), [ind('x')])).toBe(true);
  });
  it('presión, glucosa y colesterol, aunque estén dentro de «corazón y metabolismo» (la agrupación no elude la supervisión)', () => {
    const cardio = getCategory('cardiometabolic');
    expect(requiresValidation(cardio, [ind('weekly_activity_minutes')])).toBe(false);
    expect(requiresValidation(cardio, [ind('weekly_activity_minutes'), ind('glucose')])).toBe(true);
    expect(requiresValidation(cardio, [ind('triglycerides')])).toBe(true);
    expect(requiresValidation(cardio, [ind('blood_pressure_systolic')])).toBe(true);
  });
  it('fuerza, peso y estrés no; «recomendada» no obliga', () => {
    for (const id of ['strength', 'weight', 'stress', 'body_fat']) expect(requiresValidation(getCategory(id), [ind('x')])).toBe(false);
  });
  it('hasAllTargets exige meta en todos', () => {
    expect(hasAllTargets([{ target: { value: 1 } }, { target: null }])).toBe(false);
    expect(hasAllTargets([{ target: { value: 1 } }])).toBe(true);
  });
});
