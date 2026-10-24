/**
 * PRUEBAS — Textos y sugerencias de Mis objetivos PRIME (src/lib/goals.ts): lo que se muestra nunca afirma más que el dato.
 */
import { describe, it, expect } from 'vitest';

const { safetyNote, pendingCheckins, historyText, shouldPromptGoals, formatValue, decimalText, changeText, startingPoint, paramsText, statusLabel, activeGoals, exerciseLabel } = await import('../../src/lib/goals.ts');
const { publicCatalog } = await import('../config/goalCatalog.js');

const catalog = publicCatalog();
const cat = (id) => catalog.categories.find((c) => c.id === id);
const ind = (id) => catalog.categories.flatMap((c) => c.indicators).find((i) => i.id === id);

describe('cómo se escribe un valor', () => {
  it('coma decimal y unidad legible', () => {
    expect(formatValue(67.5, 'kg')).toBe('67,5 kg');
    expect(formatValue(35.5, 'cm')).toBe('35,5 cm');
    expect(formatValue(6, '/10')).toBe('6 de 10');
    expect(formatValue(140, '°')).toBe('140°');
    expect(formatValue(24, '%')).toBe('24 %');
    expect(decimalText(1.5)).toBe('1,5');
  });
});

describe('frase del cambio medido', () => {
  const p = (over) => ({ indicatorId: 'perimeter_muscle', unit: 'cm', change: 1.5, baseline: { value: 34, day: '2026-09-01' }, ...over });
  it('un perímetro «aumentó 1,5 cm»: nunca dice que sea músculo', () => {
    const t = changeText(p());
    expect(t).toBe('Tu perímetro aumentó 1,5 cm desde el inicio');
    expect(t).not.toMatch(/músculo/i);
  });
  it('disminuyó, sin cambios y sin punto de partida', () => {
    expect(changeText(p({ indicatorId: 'perimeter_waist', change: -4 }))).toBe('Tu perímetro disminuyó 4 cm desde el inicio');
    expect(changeText(p({ change: 0 }))).toBe('Sin cambios desde tu punto de partida');
    expect(changeText(p({ baseline: null, change: null }))).toBeNull();
  });
});

describe('punto de partida que ya existe', () => {
  const sources = {
    exercises: [{ key: 'press banca', name: 'Press banca', sessions: 3, loads: [67.5], bestLoadKg: 67.5, lastDay: '2026-10-01' }],
    perimeters: { bicepFlexedRight: { value: 34, day: '2026-09-01', count: 2 } },
    weight: { value: 82, day: '2026-10-01', count: 4 },
    bodyFatPercentage: null, muscleMassPercentage: null, jumps: {},
    painAreas: { 'rodilla-derecha': { count: 2, value: 3, day: '2026-10-01' } },
  };
  it('lo toma de los registros: ejercicio, perímetro, peso y dolor por zona', () => {
    expect(startingPoint(ind('exercise_max_load'), { exerciseKey: 'press banca' }, sources)).toMatchObject({ value: 67.5 });
    expect(startingPoint(ind('perimeter_muscle'), { field: 'bicepFlexedRight' }, sources)).toMatchObject({ value: 34 });
    expect(startingPoint(ind('body_weight'), {}, sources)).toMatchObject({ value: 82 });
    expect(startingPoint(ind('pain_eva'), { bodyArea: 'rodilla-derecha' }, sources)).toMatchObject({ value: 3, day: '2026-10-01' });
  });
  it('si no hay registro devuelve null: nunca inventa un número', () => {
    expect(startingPoint(ind('perimeter_muscle'), { field: 'bicepFlexedLeft' }, sources)).toBeNull();
    expect(startingPoint(ind('exercise_max_load'), { exerciseKey: 'peso muerto' }, sources)).toBeNull();
    expect(startingPoint(ind('pain_eva'), { bodyArea: 'cuello' }, sources)).toBeNull();
    expect(startingPoint(ind('stress_perceived'), {}, sources)).toBeNull();
    expect(startingPoint(ind('body_weight'), {}, null)).toBeNull();
  });
});

describe('textos', () => {
  it('nombra el indicador con lo elegido: lado y zona, no solo «perímetro»', () => {
    expect(paramsText({ indicatorId: 'perimeter_muscle', params: { field: 'bicepFlexedRight' } }, cat('muscle_mass'))).toBe('Bíceps contraído derecho');
    expect(paramsText({ indicatorId: 'pain_eva', params: { bodyArea: 'rodilla-derecha' } }, cat('pain'))).toBe('Rodilla derecha');
    expect(paramsText({ indicatorId: 'exercise_reps_at_load', params: { exerciseKey: 'press banca', loadKg: 40 } }, cat('strength'))).toBe('Press banca · con 40 kg');
    expect(exerciseLabel('press banca')).toBe('Press banca');
  });
  it('distingue meta propia, validada y pendiente', () => {
    expect(statusLabel({ status: 'active', validated: false }).tone).toBe('own');
    expect(statusLabel({ status: 'active', validated: true }).tone).toBe('validated');
    expect(statusLabel({ status: 'pending_validation', validated: false }).tone).toBe('pending');
    expect(statusLabel({ status: 'paused' }).tone).toBe('paused');
  });
  it('un objetivo sin meta todavía se muestra como «Meta por definir», no como meta propia', () => {
    const sinMeta = { status: 'active', validated: false, createdByRole: 'patient', progress: { indicators: [{ target: null }] } };
    expect(statusLabel(sinMeta).text).toBe('Meta por definir');
    expect(statusLabel(sinMeta, 'staff').text).toBe('Falta definir la meta');
    expect(statusLabel({ ...sinMeta, progress: { indicators: [{ target: { value: 70 } }] } }).text).toBe('Meta propia');
  });
  it('los activos van del principal a los secundarios y excluyen pausados', () => {
    const goals = [{ status: 'paused', slot: null }, { status: 'active', slot: 3 }, { status: 'pending_validation', slot: 1 }, { status: 'active', slot: 2 }];
    expect(activeGoals(goals).map((g) => g.slot)).toEqual([1, 2, 3]);
  });
});

describe('pregunta de objetivos al ingresar', () => {
  const base = { hasPlan: true, goalsLoaded: true, goalCount: 0, pref: {}, now: 1_000_000 };
  it('se pregunta a quien tiene plan vigente y aún no definió ningún objetivo', () => {
    expect(shouldPromptGoals(base)).toBe(true);
  });
  it('no se pregunta sin plan, mientras no cargaron los objetivos, ni a quien ya tiene alguno', () => {
    expect(shouldPromptGoals({ ...base, hasPlan: false })).toBe(false);
    expect(shouldPromptGoals({ ...base, goalsLoaded: false })).toBe(false);
    expect(shouldPromptGoals({ ...base, goalCount: 1 })).toBe(false);
  });
  it('«Más tarde» la pospone y vuelve a aparecer al vencer; «No quiero» la apaga', () => {
    expect(shouldPromptGoals({ ...base, pref: { snoozedUntil: base.now + 1000 } })).toBe(false);
    expect(shouldPromptGoals({ ...base, pref: { snoozedUntil: base.now - 1 } })).toBe(true);
    expect(shouldPromptGoals({ ...base, pref: { optOut: true } })).toBe(false);
  });
});

describe('historial de cambios y vista del profesional', () => {
  const inds = [{ seriesKey: 'k', label: 'Dolor', unit: '/10' }];
  it('describe cada cambio con el valor anterior (nada se pisa en silencio)', () => {
    expect(historyText({ action: 'target_changed', byRole: 'professional', note: null, changes: { seriesKey: 'k', from: { value: 3 }, to: { value: 2 } } }, inds)).toBe('Meta cambiada por el profesional: de 3 de 10 a 2 de 10');
    expect(historyText({ action: 'target_changed', byRole: 'professional', note: null, changes: { seriesKey: 'k', from: null, to: { value: 2 } } }, inds)).toBe('Meta definida por el profesional: 2 de 10');
    expect(historyText({ action: 'created', byRole: 'patient', note: null, changes: null })).toBe('Objetivo creado por el paciente');
    expect(historyText({ action: 'discarded', byRole: 'professional', note: 'No corresponde', changes: null })).toBe('Objetivo descartado: No corresponde');
    expect(historyText({ action: 'validated', byRole: 'professional', note: null, changes: null })).toBe('Validado por el profesional');
  });
  it('el profesional distingue la meta del paciente de la validada', () => {
    expect(statusLabel({ status: 'active', validated: false, createdByRole: 'patient' }, 'staff').text).toBe('Meta del paciente');
    expect(statusLabel({ status: 'active', validated: false, createdByRole: 'professional' }, 'staff').text).toBe('Meta propuesta por el equipo');
    expect(statusLabel({ status: 'active', validated: true, createdByRole: 'patient' }, 'staff').text).toBe('Validado');
    expect(statusLabel({ status: 'pending_validation', validated: false, createdByRole: 'patient' }, 'staff').text).toBe('Por validar');
  });
});

describe('check-in semanal', () => {
  const catalog = publicCatalog();
  const ind = (over) => ({ seriesKey: 's', indicatorId: 'stress_perceived', unit: '/10', manual: true, professionalEntryOnly: false, lastDay: null, ...over });
  const goal = (indicators, over = {}) => ({ id: 'g1', categoryId: 'stress', categoryName: 'Manejar el estrés', status: 'active', reminders: true, progress: { indicators }, ...over });
  it('pregunta lo manual que no se registró en 7 días', () => {
    const r = pendingCheckins([goal([ind({ lastDay: '2026-10-10' })])], catalog, '2026-10-24');
    expect(r).toHaveLength(1);
    expect(r[0].question).toBe('¿Cómo estuvo tu nivel de estrés esta semana? (0 a 10)');
    expect(pendingCheckins([goal([ind()])], catalog, '2026-10-24')).toHaveLength(1);
  });
  it('no pregunta si ya registró esta semana, ni lo que llega solo, ni lo del profesional, ni con recordatorios apagados, ni objetivos pausados', () => {
    expect(pendingCheckins([goal([ind({ lastDay: '2026-10-20' })])], catalog, '2026-10-24')).toEqual([]);
    expect(pendingCheckins([goal([ind({ manual: false, indicatorId: 'body_weight' })])], catalog, '2026-10-24')).toEqual([]);
    expect(pendingCheckins([goal([ind({ professionalEntryOnly: true, indicatorId: 'rom_degrees' })])], catalog, '2026-10-24')).toEqual([]);
    expect(pendingCheckins([goal([ind()], { reminders: false })], catalog, '2026-10-24')).toEqual([]);
    expect(pendingCheckins([goal([ind()], { status: 'paused' })], catalog, '2026-10-24')).toEqual([]);
  });
  it('como máximo dos preguntas a la vez', () => {
    const many = goal([ind({ seriesKey: 'a' }), ind({ seriesKey: 'b', indicatorId: 'sleep_hours', unit: 'h' }), ind({ seriesKey: 'c', indicatorId: 'weekly_activity_minutes', unit: 'min' })]);
    expect(pendingCheckins([many], catalog, '2026-10-24')).toHaveLength(2);
  });
});

describe('orientación prudente', () => {
  it('dolor, movilidad, postura, corazón y estrés llevan una vía para contactar al equipo; fuerza no', () => {
    for (const id of ['pain', 'mobility', 'posture', 'cardiometabolic', 'stress']) expect(safetyNote(id)).toBeTruthy();
    expect(safetyNote('strength')).toBeNull();
  });
  it('no diagnostica ni da indicaciones terapéuticas', () => {
    for (const id of ['pain', 'mobility', 'posture', 'cardiometabolic', 'stress']) expect(safetyNote(id)).not.toMatch(/tienes (ansiedad|depresi|diabetes|hipertens)|toma |debes tomar|ejercicio recomendado/i);
  });
});
